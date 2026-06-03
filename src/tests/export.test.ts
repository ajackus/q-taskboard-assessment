import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";

// ── Hoist mock fns so they are available inside vi.mock factories ─────────────

const {
  mockFetchAll,
  mockBatchCreate,
  mockBatchUpdate,
  mockSleep,
  mockGetFieldMap,
} = vi.hoisted(() => ({
  mockFetchAll: vi.fn(),
  mockBatchCreate: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockSleep: vi.fn(),
  mockGetFieldMap: vi.fn(),
}));

/** Default field map returned by the mock — matches the real defaults. */
const DEFAULT_FIELD_MAP = {
  taskId: "TaskID",
  title: "Title",
  description: "Description",
  status: "Status",
  assignee: "Assignee",
  createdBy: "CreatedBy",
  position: "Position",
};

vi.mock("@/lib/airtable", () => ({
  getAirtableTableClient: vi.fn(() => ({
    fetchAll: mockFetchAll,
    batchCreate: mockBatchCreate,
    batchUpdate: mockBatchUpdate,
  })),
  // no-op sleep: tests run without real delays
  sleep: mockSleep,
  getFieldMap: mockGetFieldMap,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn() },
    task: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/projects/[id]/export/route";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = "user_1";
const TOKEN = signToken({ userId: USER_ID, email: "user@test.com" });

const MOCK_USER = { id: USER_ID, email: "user@test.com", name: "Test User" };
const MOCK_PROJECT = { id: "proj_1", name: "Alpha" };

const MOCK_TASK = {
  id: "task_1",
  projectId: "proj_1",
  title: "Do the thing",
  description: "desc",
  status: "todo" as const,
  assigneeId: null,
  createdById: USER_ID,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignee: null,
  createdBy: { id: USER_ID, name: "Test User", email: "user@test.com" },
};

const PARAMS = { params: Promise.resolve({ id: "proj_1" }) };

function makeRequest(token = TOKEN) {
  return new NextRequest("http://localhost/api/projects/proj_1/export", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Build N distinct mock tasks. */
function makeTasks(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    ...MOCK_TASK,
    id: `task_${i + 1}`,
    title: `Task ${i + 1}`,
    position: i,
  }));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Healthy defaults
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
  (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_PROJECT);
  (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    role: "admin",
  });
  (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_TASK]);
  mockFetchAll.mockResolvedValue([]);
  mockBatchCreate.mockResolvedValue(undefined);
  mockBatchUpdate.mockResolvedValue(undefined);
  mockSleep.mockResolvedValue(undefined);
  // Default field map matches production defaults (env vars not set)
  mockGetFieldMap.mockReturnValue(DEFAULT_FIELD_MAP);
});

// ── Authorization ─────────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — authorization", () => {
  it("returns 401 when no token is supplied", async () => {
    const req = new NextRequest("http://localhost/api/projects/proj_1/export", {
      method: "POST",
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when project does not exist", async () => {
    (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller has no project membership", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest(), PARAMS);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("returns 403 when caller has viewer role", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "viewer",
    });
    const res = await POST(makeRequest(), PARAMS);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/viewer/i);
  });

  it("allows admin to trigger export — returns 200", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "admin",
    });
    const res = await POST(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  it("allows member to trigger export — returns 200", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "member",
    });
    const res = await POST(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
  });
});

// ── Upsert / idempotency ──────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — upsert pattern", () => {
  it("creates a new record when task does not exist in Airtable", async () => {
    mockFetchAll.mockResolvedValue([]); // no existing records
    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(1);
    expect(body.updated).toBe(0);
    expect(mockBatchCreate).toHaveBeenCalledOnce();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });

  it("updates existing record when TaskID already present in Airtable", async () => {
    mockFetchAll.mockResolvedValue([
      { id: "rec_abc", fields: { TaskID: "task_1", Title: "Old title" } },
    ]);
    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(mockBatchCreate).not.toHaveBeenCalled();
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "rec_abc" }),
      ])
    );
  });

  it("splits mixed tasks correctly between create and update arrays", async () => {
    // task_1 exists in Airtable; task_2 is new
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeTasks(2)
    );
    mockFetchAll.mockResolvedValue([
      { id: "rec_existing", fields: { TaskID: "task_1" } },
    ]);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(1);
    expect(body.updated).toBe(1);
  });

  it("running the export twice does not duplicate records (idempotency)", async () => {
    // First export — nothing in Airtable
    mockFetchAll.mockResolvedValue([]);
    await POST(makeRequest(), PARAMS);
    expect(mockBatchCreate).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    mockSleep.mockResolvedValue(undefined);
    mockBatchCreate.mockResolvedValue(undefined);
    mockBatchUpdate.mockResolvedValue(undefined);

    // Second export — task_1 now exists in Airtable
    mockFetchAll.mockResolvedValue([
      { id: "rec_task_1", fields: { TaskID: "task_1" } },
    ]);
    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(mockBatchCreate).not.toHaveBeenCalled();
  });

  it("maps correct fields onto each Airtable record", async () => {
    mockFetchAll.mockResolvedValue([]);
    await POST(makeRequest(), PARAMS);

    expect(mockBatchCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        fields: expect.objectContaining({
          TaskID: "task_1",
          Title: "Do the thing",
          Status: "todo",
          Position: 0,
        }),
      }),
    ]);
  });
});

// ── Batching ──────────────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — batching", () => {
  it("splits 25 tasks into 3 create batches of [10, 10, 5]", async () => {
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeTasks(25)
    );
    mockFetchAll.mockResolvedValue([]);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(25);
    expect(mockBatchCreate).toHaveBeenCalledTimes(3);

    // Verify individual batch sizes
    const calls = mockBatchCreate.mock.calls;
    expect(calls[0][0]).toHaveLength(10);
    expect(calls[1][0]).toHaveLength(10);
    expect(calls[2][0]).toHaveLength(5);
  });

  it("splits 11 update records into 2 update batches of [10, 1]", async () => {
    const tasks = makeTasks(11);
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(tasks);
    // All 11 tasks exist in Airtable
    mockFetchAll.mockResolvedValue(
      tasks.map((t, i) => ({ id: `rec_${i}`, fields: { TaskID: t.id } }))
    );

    await POST(makeRequest(), PARAMS);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    const calls = mockBatchUpdate.mock.calls;
    expect(calls[0][0]).toHaveLength(10);
    expect(calls[1][0]).toHaveLength(1);
  });

  it("does not call batchCreate or batchUpdate when project has no tasks", async () => {
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.updated).toBe(0);
    expect(mockBatchCreate).not.toHaveBeenCalled();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });
});

// ── Throttling / pacing ───────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — throttling", () => {
  it("does not sleep when there is only one batch", async () => {
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeTasks(5)
    );
    await POST(makeRequest(), PARAMS);
    expect(mockSleep).not.toHaveBeenCalled();
  });

  it("sleeps between batches for 3 create batches (25 tasks → 2 sleeps)", async () => {
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeTasks(25)
    );
    await POST(makeRequest(), PARAMS);

    // 3 batches → sleep is called twice (before batch 1 and batch 2)
    expect(mockSleep).toHaveBeenCalledTimes(2);
    expect(mockSleep).toHaveBeenCalledWith(250);
  });

  it("sleeps between create and update batches in a mixed export", async () => {
    // 10 creates (1 batch) + 10 updates (1 batch) = 2 batches → 1 sleep
    const tasks = makeTasks(20);
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(tasks);
    mockFetchAll.mockResolvedValue(
      tasks.slice(10).map((t, i) => ({ id: `rec_${i}`, fields: { TaskID: t.id } }))
    );

    await POST(makeRequest(), PARAMS);
    expect(mockSleep).toHaveBeenCalledTimes(1);
    expect(mockSleep).toHaveBeenCalledWith(250);
  });
});

// ── Retry on HTTP 429 ─────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — retry on rate limit", () => {
  it("retries a batch once after a 429 error and reports success", async () => {
    const rateLimitErr = Object.assign(new Error("rate limited"), {
      statusCode: 429,
    });
    mockBatchCreate
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(0);
    // Called twice: first attempt failed, second succeeded
    expect(mockBatchCreate).toHaveBeenCalledTimes(2);
  });

  it("reports a batch as failed after exhausting all retries", async () => {
    const rateLimitErr = Object.assign(new Error("still rate limited"), {
      statusCode: 429,
    });
    // Always fails (will exhaust maxRetries = 3, so 4 total attempts)
    mockBatchCreate.mockRejectedValue(rateLimitErr);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toMatch(/rate limited/i);
    // 4 total attempts: attempt 0 + 3 retries
    expect(mockBatchCreate).toHaveBeenCalledTimes(4);
  });

  it("does NOT retry non-429 errors", async () => {
    mockBatchCreate.mockRejectedValue(new Error("invalid field type"));

    await POST(makeRequest(), PARAMS);
    // Only 1 attempt — no retry for non-rate-limit errors
    expect(mockBatchCreate).toHaveBeenCalledTimes(1);
  });
});

// ── Fault isolation ───────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — fault isolation", () => {
  it("continues processing remaining batches when one batch fails", async () => {
    // 20 tasks → 2 create batches of 10
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeTasks(20)
    );
    // First batch: non-429 error (no retry); second batch: success
    mockBatchCreate
      .mockRejectedValueOnce(new Error("field validation error"))
      .mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    // Second batch was processed despite first failing
    expect(body.created).toBe(10);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toMatch(/field validation error/i);
    expect(mockBatchCreate).toHaveBeenCalledTimes(2);
  });

  it("response is still 200 even when partial errors occur", async () => {
    mockBatchCreate.mockRejectedValue(new Error("bad payload"));
    const res = await POST(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.errors).toHaveLength(1);
  });

  it("an update batch failure does not prevent create batches from completing", async () => {
    // 5 new + 5 existing → 1 create batch + 1 update batch
    const tasks = makeTasks(10);
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(tasks);
    mockFetchAll.mockResolvedValue(
      tasks.slice(5).map((t, i) => ({ id: `rec_${i}`, fields: { TaskID: t.id } }))
    );
    mockBatchCreate.mockResolvedValue(undefined);
    mockBatchUpdate.mockRejectedValue(new Error("update failed"));

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.created).toBe(5);
    expect(body.updated).toBe(0);
    expect(body.errors).toHaveLength(1);
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — response shape", () => {
  it("returns ok:true, projectId, taskCount, created, updated, errors on success", async () => {
    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body).toMatchObject({
      ok: true,
      projectId: "proj_1",
      taskCount: 1,
      created: 1,
      updated: 0,
      errors: [],
    });
  });
});

// ── Field name configuration ──────────────────────────────────────────────────

describe("POST /api/projects/[id]/export — field name configuration", () => {
  it("uses the taskId field name from getFieldMap for upsert lookup", async () => {
    mockGetFieldMap.mockReturnValue({
      ...DEFAULT_FIELD_MAP,
      taskId: "LocalID", // operator renamed the column
    });
    // Airtable already has the task stored under the custom field name
    mockFetchAll.mockResolvedValue([
      { id: "rec_123", fields: { LocalID: "task_1" } },
    ]);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    // Should recognise the existing record and route to update, not create
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "rec_123" })])
    );
    expect(mockBatchCreate).not.toHaveBeenCalled();
  });

  it("builds record fields using all names from getFieldMap", async () => {
    const customMap = {
      taskId:      "LocalID",
      title:       "Name",
      description: "Notes",
      status:      "Stage",
      assignee:    "Owner",
      createdBy:   "Author",
      position:    "Order",
    };
    mockGetFieldMap.mockReturnValue(customMap);
    mockFetchAll.mockResolvedValue([]);

    await POST(makeRequest(), PARAMS);

    expect(mockBatchCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        fields: expect.objectContaining({
          LocalID: "task_1",
          Name:    "Do the thing",
          Stage:   "todo",
          Order:   0,
        }),
      }),
    ]);
    // Legacy hardcoded names must NOT appear when custom map is active
    const calledFields = mockBatchCreate.mock.calls[0][0][0].fields as Record<string, unknown>;
    expect(calledFields["TaskID"]).toBeUndefined();
    expect(calledFields["Title"]).toBeUndefined();
  });

  it("converts Airtable 422 UNKNOWN_FIELD_NAME into an actionable error message", async () => {
    // Simulate the real Airtable SDK error shape
    const airtable422 = Object.assign(
      new Error('Unknown field name: "TaskID"'),
      { statusCode: 422, error: "UNKNOWN_FIELD_NAME" }
    );
    mockBatchCreate.mockRejectedValue(airtable422);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    // Error should mention the offending field name
    expect(body.errors[0]).toMatch(/TaskID/);
    // Error should give actionable env-var guidance
    expect(body.errors[0]).toMatch(/AIRTABLE_FIELD_/);
    // Overall export still returns 200 (fault isolation holds)
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("converts Airtable 422 without a field name into a generic config message", async () => {
    const airtable422 = Object.assign(new Error("Unprocessable Entity"), {
      statusCode: 422,
    });
    mockBatchCreate.mockRejectedValue(airtable422);

    const res = await POST(makeRequest(), PARAMS);
    const body = await res.json();

    expect(body.errors[0]).toMatch(/422/);
  });
});
