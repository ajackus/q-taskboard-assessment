import {
  airtableErrorMessage,
  isPermanentAirtableError,
  isRetryableAirtableError,
} from "@/lib/airtable-errors";
import type { AirtableFieldValue, AirtableRecordWriter, AirtableUpsertInput } from "@/lib/airtable-client";
import { getAirtableBaseUrl } from "@/lib/airtable-client";

export const TASKBOARD_ID_FIELD = "TaskBoard ID";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;
const MAX_ATTEMPTS = 3;

export type ExportTaskInput = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  position: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignee?: { name: string; email: string } | null;
};

/** Writable date fields (ISO 8601). Avoid "Created At"/"Updated At" — often computed in Airtable. */
export const TASK_CREATED_AT_FIELD = "Task Created At";
export const TASK_UPDATED_AT_FIELD = "Task Updated At";

function toIsoDateTime(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export type ExportFailedRecord = {
  taskId: string;
  title: string;
  error: string;
};

export type ExportResult = {
  total: number;
  succeeded: number;
  failed: ExportFailedRecord[];
  airtableUrl: string;
};

export function taskToAirtableFields(
  task: ExportTaskInput,
  projectName: string
): Record<string, AirtableFieldValue> {
  const fields: Record<string, AirtableFieldValue> = {
    [TASKBOARD_ID_FIELD]: task.id,
    Title: task.title,
    Description: task.description ?? "",
    Status: task.status,
    Assignee: task.assignee?.name ?? "",
    Position: task.position,
    "Project Name": projectName,
    [TASK_CREATED_AT_FIELD]: toIsoDateTime(task.createdAt),
    [TASK_UPDATED_AT_FIELD]: toIsoDateTime(task.updatedAt),
  };
  return fields;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = MAX_ATTEMPTS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (isPermanentAirtableError(err) || !isRetryableAirtableError(err)) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await sleep(200 * Math.pow(2, attempt - 1));
      }
    }
  }
  throw lastError;
}

async function upsertBatchWithRetry(
  writer: AirtableRecordWriter,
  records: AirtableUpsertInput[]
): Promise<void> {
  await retryWithBackoff(() => writer.upsertBatch(records));
}

async function upsertSingleWithRetry(
  writer: AirtableRecordWriter,
  record: AirtableUpsertInput
): Promise<void> {
  await retryWithBackoff(() => writer.upsertBatch([record]));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function exportTasksToAirtable(options: {
  tasks: ExportTaskInput[];
  projectName: string;
  writer: AirtableRecordWriter;
  baseId: string;
}): Promise<ExportResult> {
  const { tasks, projectName, writer, baseId } = options;
  const failed: ExportFailedRecord[] = [];
  let succeeded = 0;

  const batches = chunk(tasks, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const records = batch.map((task) => ({
      task,
      input: { fields: taskToAirtableFields(task, projectName) },
    }));

    try {
      await upsertBatchWithRetry(
        writer,
        records.map((r) => r.input)
      );
      succeeded += batch.length;
    } catch {
      for (const { task, input } of records) {
        try {
          await upsertSingleWithRetry(writer, input);
          succeeded += 1;
        } catch (err) {
          failed.push({
            taskId: task.id,
            title: task.title,
            error: airtableErrorMessage(err),
          });
        }
      }
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return {
    total: tasks.length,
    succeeded,
    failed,
    airtableUrl: getAirtableBaseUrl(baseId),
  };
}
