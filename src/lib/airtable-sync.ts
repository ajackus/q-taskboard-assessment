import { airtable } from "./airtable";
import {
  AirtableError,
  type AirtableCreateInput,
  type AirtableFields,
  type AirtableRecord,
} from "./airtable-mock";
import type { ApiTask } from "@/types";

/**
 * The Airtable table columns this sync writes to. Create these manually in the
 * base before syncing (Airtable rejects writes to non-existent fields).
 *
 *   Task ID      — Single line text   (idempotency key; do NOT edit in Airtable)
 *   Title        — Single line text
 *   Description  — Long text
 *   Status       — Single select      (pre-add ALL 4 options: todo, in_progress,
 *                                       review, done — API tokens usually can't
 *                                       create options on the fly. Or use text.)
 *   Assignee     — Single line text
 *   Project ID   — Single line text
 *   Position     — Number (integer)
 *   Created At   — Date (date-only; we send YYYY-MM-DD)
 */
export const REQUIRED_COLUMNS = [
  "Task ID",
  "Title",
  "Description",
  "Status",
  "Assignee",
  "Project ID",
  "Position",
  "Created At",
] as const;

const TASK_ID_FIELD = "Task ID";

function taskToFields(task: ApiTask): AirtableFields {
  return {
    [TASK_ID_FIELD]: task.id,
    Title: task.title,
    Description: task.description ?? "",
    Status: task.status,
    Assignee: task.assignee?.name ?? task.assigneeId ?? "",
    "Project ID": task.projectId,
    Position: task.position,
    // Airtable "Created At" is a date-only field (Include time OFF) — send
    // YYYY-MM-DD. Handles both Date (from Prisma) and ISO string (from tests).
    "Created At": new Date(task.createdAt).toISOString().slice(0, 10),
  };
}

export type AirtableClient = {
  list(): Promise<AirtableRecord[]>;
  create(input: AirtableCreateInput): Promise<AirtableRecord>;
  update(id: string, fields: AirtableFields): Promise<AirtableRecord>;
};

const RETRYABLE = new Set(["rate-limit", "server-error", "network"]);

const sleep = (ms: number) =>
  ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

/**
 * Retry a call with exponential backoff + jitter. Only retries transient
 * Airtable errors (rate-limit / server-error / network); anything else throws
 * immediately so we don't loop on a real bug.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 200,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof AirtableError && RETRYABLE.has(err.type);
      if (!retryable || attempt >= maxRetries) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
      await sleep(delay);
      attempt++;
    }
  }
}

export type SyncResult = {
  total: number;
  synced: number;
  failed: { taskId: string; error: string }[];
};

/**
 * Push all given tasks to Airtable. Idempotent: matches existing rows by the
 * "Task ID" field and updates them instead of creating duplicates. Records are
 * processed concurrently and independently — one failing record (after its
 * retries) does not abort the rest.
 */
export async function syncTasksToAirtable(
  tasks: ApiTask[],
  client: AirtableClient = airtable,
  opts: { maxRetries?: number; baseDelayMs?: number } = {},
): Promise<SyncResult> {
  // Build Task ID -> existing record id map so re-syncs upsert, not duplicate.
  const existing = await withRetry(
    () => client.list(),
    opts.maxRetries,
    opts.baseDelayMs,
  );
  const byTaskId = new Map<string, string>();
  for (const rec of existing as AirtableRecord[]) {
    const key = rec.fields[TASK_ID_FIELD];
    if (typeof key === "string") byTaskId.set(key, rec.id);
  }

  const results = await Promise.allSettled(
    tasks.map((task) => {
      const fields = taskToFields(task);
      const recId = byTaskId.get(task.id);
      return withRetry(
        () =>
          recId
            ? client.update(recId, fields)
            : client.create({ fields }),
        opts.maxRetries,
        opts.baseDelayMs,
      );
    }),
  );

  const failed: SyncResult["failed"] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed.push({
        taskId: tasks[i].id,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  return { total: tasks.length, synced: tasks.length - failed.length, failed };
}
