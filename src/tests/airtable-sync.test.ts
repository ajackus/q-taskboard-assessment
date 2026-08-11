import { describe, it, expect } from "vitest";
import { AirtableMockClient } from "@/lib/airtable-mock";
import { syncTasksToAirtable } from "@/lib/airtable-sync";
import type { ApiTask } from "@/types";

const task = (id: string): ApiTask => ({
  id,
  projectId: "p1",
  title: `Task ${id}`,
  description: null,
  status: "todo",
  assigneeId: null,
  createdById: "u1",
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const opts = { baseDelayMs: 0 }; // no real sleeping in tests

describe("syncTasksToAirtable", () => {
  it("creates one record per task", async () => {
    const c = new AirtableMockClient();
    const r = await syncTasksToAirtable([task("a"), task("b")], c, opts);
    expect(r).toMatchObject({ total: 2, synced: 2, failed: [] });
    expect(c.__getRecordCount()).toBe(2);
  });

  it("is idempotent — re-syncing does not duplicate", async () => {
    const c = new AirtableMockClient();
    await syncTasksToAirtable([task("a"), task("b")], c, opts);
    await syncTasksToAirtable([task("a"), task("b")], c, opts);
    expect(c.__getRecordCount()).toBe(2);
  });

  it("retries transient failures with backoff", async () => {
    const c = new AirtableMockClient();
    let calls = 0;
    const orig = c.create.bind(c);
    // fail twice, then succeed
    c.create = async (input) => {
      calls++;
      if (calls <= 2) {
        const { AirtableError } = await import("@/lib/airtable-mock");
        throw new AirtableError("boom", "rate-limit", 429);
      }
      return orig(input);
    };
    const r = await syncTasksToAirtable([task("a")], c, opts);
    expect(r.synced).toBe(1);
    expect(calls).toBe(3);
  });

  it("isolates a permanently failing record without aborting the rest", async () => {
    const c = new AirtableMockClient();
    const orig = c.create.bind(c);
    c.create = async (input) => {
      if (input.fields["Task ID"] === "b") {
        const { AirtableError } = await import("@/lib/airtable-mock");
        throw new AirtableError("nope", "server-error", 500);
      }
      return orig(input);
    };
    const r = await syncTasksToAirtable([task("a"), task("b"), task("c")], c, opts);
    expect(r.synced).toBe(2);
    expect(r.failed).toEqual([{ taskId: "b", error: "nope" }]);
    expect(c.__getRecordCount()).toBe(2);
  });
});
