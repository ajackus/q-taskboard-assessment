import { describe, it, expect, beforeEach } from "vitest";
import { AirtableMockClient } from "@/lib/airtable-mock";
import { exportTasksToAirtable, type ExportableTask } from "@/lib/airtable-export";
import type { AirtableClient } from "@/lib/airtable";

function task(overrides: Partial<ExportableTask> = {}): ExportableTask {
  return {
    id: "t1",
    title: "do the thing",
    description: null,
    status: "todo",
    assigneeEmail: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("exportTasksToAirtable", () => {
  describe("idempotency (AirtableMockClient)", () => {
    const airtable = new AirtableMockClient();

    beforeEach(() => {
      airtable.__reset();
    });

    it("creates one record per task on the first run", async () => {
      const tasks = [task({ id: "t1" }), task({ id: "t2", title: "second" })];
      const summary = await exportTasksToAirtable(airtable, tasks);

      expect(summary.exported).toBe(2);
      expect(summary.updated).toBe(0);
      expect(summary.failed).toEqual([]);
      expect(airtable.__getRecordCount()).toBe(2);
    });

    it("running the same export twice updates in place instead of duplicating", async () => {
      const tasks = [task({ id: "t1" }), task({ id: "t2", title: "second" })];

      await exportTasksToAirtable(airtable, tasks);
      const secondRun = await exportTasksToAirtable(airtable, tasks);

      expect(secondRun.exported).toBe(0);
      expect(secondRun.updated).toBe(2);
      expect(secondRun.failed).toEqual([]);
      expect(airtable.__getRecordCount()).toBe(2);
    });

    it("stores the TaskBoard task id in the Task ID field for future idempotency lookups", async () => {
      await exportTasksToAirtable(airtable, [task({ id: "t1" })]);
      const [record] = airtable.__getRecords();
      expect(record.fields["Task ID"]).toBe("t1");
    });

    it("maps description and assignee email onto the record", async () => {
      await exportTasksToAirtable(airtable, [
        task({ id: "t1", description: "more detail here", assigneeEmail: "a@b.com" }),
      ]);
      const [record] = airtable.__getRecords();
      expect(record.fields.Description).toBe("more detail here");
      expect(record.fields.Assignee).toBe("a@b.com");
    });

    it("writes an empty string for description/assignee when the task has neither", async () => {
      await exportTasksToAirtable(airtable, [
        task({ id: "t1", description: null, assigneeEmail: null }),
      ]);
      const [record] = airtable.__getRecords();
      expect(record.fields.Description).toBe("");
      expect(record.fields.Assignee).toBe("");
    });
  });

  describe("transient failures retry and succeed", () => {
    it("retries a 500 (server-error) and still exports the record", async () => {
      let attempts = 0;
      const flaky: AirtableClient = {
        async create(input) {
          attempts++;
          if (attempts === 1) {
            const err = new Error("simulated server error") as Error & { statusCode: number };
            err.statusCode = 500;
            throw err;
          }
          return { id: "rec1", fields: input.fields, createdTime: "2026-01-01T00:00:00.000Z" };
        },
        async update(id, fields) {
          return { id, fields, createdTime: "2026-01-01T00:00:00.000Z" };
        },
        async list() {
          return [];
        },
      };

      const summary = await exportTasksToAirtable(flaky, [task()]);

      expect(attempts).toBe(2);
      expect(summary.exported).toBe(1);
      expect(summary.failed).toEqual([]);
    });

    it("retries a 429 (rate limit) and still exports the record", async () => {
      let attempts = 0;
      const rateLimited: AirtableClient = {
        async create(input) {
          attempts++;
          if (attempts < 3) {
            const err = new Error("simulated rate limit") as Error & { statusCode: number };
            err.statusCode = 429;
            throw err;
          }
          return { id: "rec1", fields: input.fields, createdTime: "2026-01-01T00:00:00.000Z" };
        },
        async update(id, fields) {
          return { id, fields, createdTime: "2026-01-01T00:00:00.000Z" };
        },
        async list() {
          return [];
        },
      };

      const summary = await exportTasksToAirtable(rateLimited, [task()]);

      expect(attempts).toBe(3);
      expect(summary.exported).toBe(1);
      expect(summary.failed).toEqual([]);
    });
  });

  describe("permanent failures isolate to one record", () => {
    it("a permanent (4xx, non-429) failure on one task doesn't block the rest of the run", async () => {
      const tasks = [task({ id: "good-1" }), task({ id: "bad" }), task({ id: "good-2" })];

      let badAttempts = 0;
      const partiallyBroken: AirtableClient = {
        async create(input) {
          if (input.fields["Task ID"] === "bad") {
            badAttempts++;
            const err = new Error("validation error") as Error & { statusCode: number };
            err.statusCode = 422;
            throw err;
          }
          return { id: `rec-${input.fields["Task ID"]}`, fields: input.fields, createdTime: "2026-01-01T00:00:00.000Z" };
        },
        async update(id, fields) {
          return { id, fields, createdTime: "2026-01-01T00:00:00.000Z" };
        },
        async list() {
          return [];
        },
      };

      const summary = await exportTasksToAirtable(partiallyBroken, tasks);

      expect(summary.exported).toBe(2);
      expect(summary.failed).toEqual([{ taskId: "bad", error: "validation error" }]);
      // a permanent error must not retry
      expect(badAttempts).toBe(1);
    });
  });
});
