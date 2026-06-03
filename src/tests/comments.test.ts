import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn() },
    comment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/tasks/[id]/comments/route";

const USER_ID = "user_1";
const TOKEN = signToken({ userId: USER_ID, email: "user@test.com" });

const MOCK_USER = { id: USER_ID, email: "user@test.com", name: "Test User" };
const MOCK_TASK = { id: "task_1", projectId: "proj_1" };
const MOCK_COMMENTS = [
  {
    id: "c1",
    taskId: "task_1",
    userId: USER_ID,
    body: "first comment",
    createdAt: new Date("2025-01-01T10:00:00Z"),
    user: MOCK_USER,
  },
  {
    id: "c2",
    taskId: "task_1",
    userId: USER_ID,
    body: "second comment",
    createdAt: new Date("2025-01-01T11:00:00Z"),
    user: MOCK_USER,
  },
];
const MOCK_NEW_COMMENT = {
  id: "c3",
  taskId: "task_1",
  userId: USER_ID,
  body: "new comment",
  createdAt: new Date(),
  user: MOCK_USER,
};

const PARAMS = { params: Promise.resolve({ id: "task_1" }) };

function getRequest(token = TOKEN) {
  return new NextRequest("http://localhost/api/tasks/task_1/comments", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function postRequest(body: object, token = TOKEN) {
  return new NextRequest("http://localhost/api/tasks/task_1/comments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ─── GET ────────────────────────────────────────────────────────────────────

describe("GET /api/tasks/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
    (prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_COMMENTS);
  });

  it("returns 401 when no token is supplied", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task_1/comments");
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task does not exist", async () => {
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await GET(getRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller has no project membership", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(getRequest(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("allows admin to read comments", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await GET(getRequest(), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(2);
  });

  it("allows member to read comments", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    const res = await GET(getRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  it("allows viewer to read comments", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "viewer" });
    const res = await GET(getRequest(), PARAMS);
    expect(res.status).toBe(200);
  });

  it("returns comments ordered chronologically (ascending)", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    await GET(getRequest(), PARAMS);
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "asc" },
      })
    );
  });

  it("includes the author's user object in each comment", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    await GET(getRequest(), PARAMS);
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { user: { select: { id: true, name: true, email: true } } },
      })
    );
  });
});

// ─── POST ───────────────────────────────────────────────────────────────────

describe("POST /api/tasks/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
    (prisma.comment.create as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_NEW_COMMENT);
  });

  it("returns 401 when no token is supplied", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task_1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello" }),
    });
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task does not exist", async () => {
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await POST(postRequest({ body: "hello" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller has no project membership", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(postRequest({ body: "hello" }), PARAMS);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/not a member/i);
  });

  it("returns 403 when caller has viewer role", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "viewer" });
    const res = await POST(postRequest({ body: "I just want to comment" }), PARAMS);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/viewer/i);
  });

  it("returns 400 when body is missing", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await POST(postRequest({}), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is an empty string", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    const res = await POST(postRequest({ body: "" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("allows admin to post a comment — returns 201", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await POST(postRequest({ body: "looks good to me" }), PARAMS);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.comment.body).toBe("new comment");
  });

  it("allows member to post a comment — returns 201", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    const res = await POST(postRequest({ body: "working on this" }), PARAMS);
    expect(res.status).toBe(201);
  });

  it("stores the authenticated user's id as the comment author", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    await POST(postRequest({ body: "my comment" }), PARAMS);
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, taskId: "task_1" }),
      })
    );
  });

  it("does NOT call prisma.comment.create when viewer is blocked", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "viewer" });
    await POST(postRequest({ body: "sneaky comment" }), PARAMS);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });
});

// ─── Schema validation ───────────────────────────────────────────────────────

describe("comment Zod schema", () => {
  it("rejects body exceeding 10 000 characters", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);

    const res = await POST(postRequest({ body: "x".repeat(10001) }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("accepts body of exactly 1 character", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
    (prisma.comment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_NEW_COMMENT,
      body: "x",
    });

    const res = await POST(postRequest({ body: "x" }), PARAMS);
    expect(res.status).toBe(201);
  });
});
