import { describe, it, expect, beforeEach, vi } from "vitest";
import { AirtableError, AirtableMockClient } from "@/lib/airtable-mock";
import { createMockAirtableWriter } from "@/lib/airtable-mock-adapter";
import {
  isPermanentAirtableError,
  isRetryableAirtableError,
} from "@/lib/airtable-errors";
import type { AirtableRecordWriter } from "@/lib/airtable-client";
import {
  exportTasksToAirtable,
  retryWithBackoff,
  taskToAirtableFields,
  TASKBOARD_ID_FIELD,
  TASK_CREATED_AT_FIELD,
  TASK_UPDATED_AT_FIELD,
  type ExportTaskInput,
} from "@/lib/airtable-export";

const sampleTask = (
  id: string,
  title: string,
  assignee?: { name: string; email: string } | null
): ExportTaskInput => ({
  id,
  title,
  description: "desc",
  status: "todo",
  position: 0,
  createdAt: "2024-01-01T12:00:00.000Z",
  updatedAt: "2024-01-02T15:30:00.000Z",
  assignee: assignee ?? { name: "Meera", email: "meera@taskboard.dev" },
});

describe("airtable error classification", () => {
  it("treats rate-limit as retryable", () => {
    expect(
      isRetryableAirtableError(new AirtableError("rate limited", "rate-limit", 429))
    ).toBe(true);
  });

  it("treats 401 as permanent", () => {
    expect(isPermanentAirtableError({ statusCode: 401 })).toBe(true);
    expect(isRetryableAirtableError({ statusCode: 401 })).toBe(false);
  });
});

describe("taskToAirtableFields", () => {
  it("maps task fields including ISO dates and assignee", () => {
    const fields = taskToAirtableFields(sampleTask("task_1", "Ship feature"), "Q3 Launch");
    expect(fields[TASKBOARD_ID_FIELD]).toBe("task_1");
    expect(fields.Title).toBe("Ship feature");
    expect(fields["Project Name"]).toBe("Q3 Launch");
    expect(fields["Assignee Name"]).toBe("Meera");
    expect(fields.Assignee).toEqual({ email: "meera@taskboard.dev" });
    expect(fields[TASK_CREATED_AT_FIELD]).toBe("2024-01-01T12:00:00.000Z");
    expect(fields[TASK_UPDATED_AT_FIELD]).toBe("2024-01-02T15:30:00.000Z");
    expect(fields["Created At"]).toBeUndefined();
    expect(fields["Updated At"]).toBeUndefined();
  });

  it("omits Assignee collaborator when unassigned", () => {
    const fields = taskToAirtableFields(
      {
        id: "t1",
        title: "Solo",
        description: null,
        status: "todo",
        position: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        assignee: null,
      },
      "Proj"
    );
    expect(fields.Assignee).toBeUndefined();
  });
});

describe("exportTasksToAirtable", () => {
  let mock: AirtableMockClient;
  let writer: AirtableRecordWriter;

  beforeEach(() => {
    mock = new AirtableMockClient();
    writer = createMockAirtableWriter(mock);
  });

  it("exports all tasks to the mock", async () => {
    const tasks = [
      sampleTask("t1", "One"),
      sampleTask("t2", "Two"),
    ];
    const result = await exportTasksToAirtable({
      tasks,
      projectName: "Proj",
      writer,
      baseId: "appTest123",
    });

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toHaveLength(0);
    expect(result.airtableUrl).toBe("https://airtable.com/appTest123");
    expect(mock.__getRecordCount()).toBe(2);
  });

  it("is idempotent on re-export", async () => {
    const tasks = [sampleTask("t1", "One"), sampleTask("t2", "Two")];
    const opts = { tasks, projectName: "Proj", writer, baseId: "appX" };

    await exportTasksToAirtable(opts);
    await exportTasksToAirtable(opts);

    expect(mock.__getRecordCount()).toBe(2);
    const records = mock.__getRecords();
    expect(records.find((r) => r.id === "t1")?.fields.Title).toBe("One");
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const flakyWriter: AirtableRecordWriter = {
      async upsertBatch(records) {
        calls += 1;
        if (calls === 1) {
          throw new AirtableError("rate limited", "rate-limit", 429);
        }
        await writer.upsertBatch(records);
      },
    };

    const result = await exportTasksToAirtable({
      tasks: [sampleTask("t1", "One")],
      projectName: "Proj",
      writer: flakyWriter,
      baseId: "appX",
    });

    expect(result.succeeded).toBe(1);
    expect(calls).toBeGreaterThan(1);
  });

  it("continues when a single record fails permanently", async () => {
    const failingWriter: AirtableRecordWriter = {
      async upsertBatch(records) {
        for (const record of records) {
          const id = record.fields[TASKBOARD_ID_FIELD];
          if (id === "bad") {
            throw new AirtableError("invalid", "server-error", 422);
          }
          await writer.upsertBatch([record]);
        }
      },
    };

    const result = await exportTasksToAirtable({
      tasks: [sampleTask("ok", "OK"), sampleTask("bad", "Bad")],
      projectName: "Proj",
      writer: failingWriter,
      baseId: "appX",
    });

    expect(result.succeeded).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].taskId).toBe("bad");
  });
});

describe("retryWithBackoff", () => {
  it("does not retry permanent errors", async () => {
    let attempts = 0;
    await expect(
      retryWithBackoff(async () => {
        attempts += 1;
        throw new AirtableError("forbidden", "server-error", 403);
      }, 3)
    ).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it("retries retryable errors", async () => {
    let attempts = 0;
    const result = await retryWithBackoff(async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new AirtableError("rate limited", "rate-limit", 429);
      }
      return "ok";
    }, 3);
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});
