import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  getProjectMembership,
  canEditTasks,
} from "@/lib/auth";
import {
  getAirtableTableClient,
  getFieldMap,
  sleep,
  type AirtableTableClient,
} from "@/lib/airtable";

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;
/** 250 ms comfortably fits within Airtable's 5 req/s limit. */
const INTER_BATCH_DELAY_MS = 250;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { statusCode?: number; message?: string };
  return e.statusCode === 429 || Boolean(e.message?.includes("429"));
}

/**
 * Converts known Airtable API errors into messages with actionable guidance.
 * 422 UNKNOWN_FIELD_NAME tells the operator which env var to set.
 */
function enrichError(err: unknown): Error {
  const e = err as {
    statusCode?: number;
    error?: string;
    message?: string;
  };

  if (e.statusCode === 422) {
    // Extract the offending field name from the Airtable error message, e.g.
    // 'Unknown field name: "TaskID"'
    const fieldMatch = e.message?.match(/Unknown field name: "([^"]+)"/);
    if (fieldMatch ?? e.error === "UNKNOWN_FIELD_NAME") {
      const field = fieldMatch?.[1] ?? e.message ?? "unknown";
      return new Error(
        `Airtable column not found: "${field}". ` +
          `Set the AIRTABLE_FIELD_* env vars to match your table's column names ` +
          `(e.g. AIRTABLE_FIELD_TASK_ID, AIRTABLE_FIELD_TITLE, AIRTABLE_FIELD_STATUS …). ` +
          `Current defaults: run the export with AIRTABLE_FIELD_TASK_ID=<your_id_column>.`
      );
    }
    return new Error(`Airtable HTTP 422: ${e.message ?? "check your field names."}`);
  }

  return err instanceof Error ? err : new Error(e.message ?? String(err));
}

/** Retries `fn` up to `maxRetries` times on HTTP-429 with exponential back-off. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  baseDelayMs = BASE_RETRY_DELAY_MS
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt === maxRetries) throw err;
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }
  throw new Error("withRetry: exceeded max retries");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Route ─────────────────────────────────────────────────────────────────────

type Params = { params: Promise<{ id: string }> };

type BatchJob =
  | { kind: "create"; records: Array<{ fields: Record<string, unknown> }> }
  | { kind: "update"; records: Array<{ id: string; fields: Record<string, unknown> }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) return notFound("project not found");

  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) return forbidden("viewers cannot export tasks");

  // ── Load tasks ──────────────────────────────────────────────────────────────

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { position: "asc" },
  });

  const client: AirtableTableClient = getAirtableTableClient();

  // Read column names at request time so env-var changes take effect without
  // redeploying. All field key lookups use this map.
  const fm = getFieldMap();

  // ── Fetch latest Airtable state for upsert lookup ───────────────────────────

  const existingRecords = await client.fetchAll();
  const existingByTaskId = new Map<string, string>(
    existingRecords
      .filter((r) => typeof r.fields[fm.taskId] === "string")
      .map((r) => [r.fields[fm.taskId] as string, r.id])
  );

  // ── Classify each task as create or update ──────────────────────────────────

  const toCreate: Array<{ fields: Record<string, unknown> }> = [];
  const toUpdate: Array<{ id: string; fields: Record<string, unknown> }> = [];

  for (const task of tasks) {
    const fields: Record<string, unknown> = {
      [fm.taskId]:      task.id,
      [fm.title]:       task.title,
      [fm.description]: task.description ?? "",
      [fm.status]:      task.status,
      [fm.assignee]:    task.assignee?.name ?? "",
      [fm.createdBy]:   task.createdBy.name,
      [fm.position]:    task.position,
    };
    const existingId = existingByTaskId.get(task.id);
    if (existingId !== undefined) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  // ── Build a single ordered list of batch jobs ───────────────────────────────

  const jobs: BatchJob[] = [
    ...chunk(toCreate, BATCH_SIZE).map((r) => ({ kind: "create" as const, records: r })),
    ...chunk(toUpdate, BATCH_SIZE).map((r) => ({ kind: "update" as const, records: r })),
  ];

  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (let i = 0; i < jobs.length; i++) {
    // ── Pacing: sleep between consecutive batches ─────────────────────────────
    if (i > 0) await sleep(INTER_BATCH_DELAY_MS);

    const job = jobs[i];

    // ── Fault isolation: catch per-batch errors and continue ──────────────────
    try {
      if (job.kind === "create") {
        await withRetry(() => client.batchCreate(job.records));
        results.created += job.records.length;
      } else {
        await withRetry(() => client.batchUpdate(job.records));
        results.updated += job.records.length;
      }
    } catch (err) {
      const rich = enrichError(err);
      results.errors.push(`${job.kind} batch ${i}: ${rich.message}`);
      console.error(`[airtable-export] ${job.kind} batch ${i} failed:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    projectId,
    taskCount: tasks.length,
    ...results,
  });
}
