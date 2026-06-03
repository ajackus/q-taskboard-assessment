import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membership: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "@/app/api/tasks/[id]/route";

const USER_ID = "user_1";
const TOKEN = signToken({ userId: USER_ID, email: "user@test.com" });

const MOCK_USER = { id: USER_ID, email: "user@test.com", name: "Test User" };
const MOCK_TASK = {
  id: "task_1",
  projectId: "proj_1",
  title: "Original title",
  description: null,
  status: "todo",
  assigneeId: null,
  createdById: USER_ID,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const MOCK_TASK_UPDATED = { ...MOCK_TASK, title: "Updated", assignee: null };

function patchRequest(body: object, token = TOKEN) {
  return new NextRequest("http://localhost/api/tasks/task_1", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function deleteRequest(token = TOKEN) {
  return new NextRequest("http://localhost/api/tasks/task_1", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const PARAMS = { params: Promise.resolve({ id: "task_1" }) };

describe("PATCH /api/tasks/[id] — Issue #1 BOLA fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
    (prisma.task.update as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK_UPDATED);
  });

  it("returns 401 when no token is supplied", async () => {
    const req = new NextRequest("http://localhost/api/tasks/task_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "hacked" }),
    });
    const res = await PATCH(req, PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task does not exist", async () => {
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ title: "hacked" }), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller has no membership in the task's project", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ title: "PWNED" }), PARAMS);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
  });

  it("returns 403 when the caller has viewer role", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "viewer" });
    const res = await PATCH(patchRequest({ title: "sneaky edit" }), PARAMS);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/viewer/i);
  });

  it("allows a member to update the task", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    const res = await PATCH(patchRequest({ title: "Updated" }), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task.title).toBe("Updated");
  });

  it("allows an admin to update the task", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await PATCH(patchRequest({ title: "Updated" }), PARAMS);
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid payload (unknown status value)", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "admin" });
    const res = await PATCH(patchRequest({ status: "blocked" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("does NOT call prisma.task.update when membership check fails (no side-effects)", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await PATCH(patchRequest({ title: "PWNED" }), PARAMS);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/tasks/[id] — authorization (regression guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.task.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
    (prisma.task.delete as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASK);
  });

  it("returns 403 when caller has no membership", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller has viewer role", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "viewer" });
    const res = await DELETE(deleteRequest(), PARAMS);
    expect(res.status).toBe(403);
  });

  it("allows member to delete task", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ role: "member" });
    const res = await DELETE(deleteRequest(), PARAMS);
    expect(res.status).toBe(200);
  });
});
