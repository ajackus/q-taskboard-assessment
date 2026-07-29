import type { AirtableClient } from "@/lib/airtable";
import type { AirtableFields } from "@/lib/airtable-mock";
import { STATUS_LABELS, type TaskStatus } from "@/types";

export type ExportableTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeEmail: string | null;
  createdAt: string;
};

export type ExportFailure = { taskId: string; error: string };

export type ExportSummary = {
  exported: number;
  updated: number;
  failed: ExportFailure[];
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function isTransient(err: unknown): boolean {
  const statusCode = (err as { statusCode?: number } | null)?.statusCode;
  if (typeof statusCode !== "number") return false;
  return statusCode === 429 || statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= MAX_ATTEMPTS || !isTransient(err)) throw err;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
}

function taskFields(task: ExportableTask): AirtableFields {
  return {
    Name: task.title,
    Title: task.title,
    Description: task.description ?? "",
    "Task ID": task.id,
    Status: STATUS_LABELS[task.status],
    Assignee: task.assigneeEmail ?? "",
    createdAt: task.createdAt,
  };
}

export async function exportTasksToAirtable(
  client: AirtableClient,
  tasks: ExportableTask[]
): Promise<ExportSummary> {
  const existing = await client.list();
  const airtableIdByTaskId = new Map<string, string>();
  for (const record of existing) {
    const taskId = record.fields["Task ID"];
    if (typeof taskId === "string") airtableIdByTaskId.set(taskId, record.id);
  }

  const summary: ExportSummary = { exported: 0, updated: 0, failed: [] };

  // Per-record isolation: one task's failure must not affect the others.
  await Promise.all(
    tasks.map(async (task) => {
      try {
        await withRetry(async () => {
          const existingId = airtableIdByTaskId.get(task.id);
          if (existingId) {
            await client.update(existingId, taskFields(task));
            summary.updated++;
          } else {
            const created = await client.create({ fields: taskFields(task) });
            airtableIdByTaskId.set(task.id, created.id);
            summary.exported++;
          }
        });
      } catch (err) {
        summary.failed.push({
          taskId: task.id,
          error: err instanceof Error ? err.message : "unknown error",
        });
      }
    })
  );

  return summary;
}
