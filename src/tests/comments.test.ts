import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/tasks/[id]/comments/route";
import * as auth from "../lib/auth";
import { prisma } from "../lib/prisma";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/auth");
vi.mock("../lib/prisma", () => ({
  prisma: {
    task: { findUnique: vi.fn() },
    comment: { findMany: vi.fn(), create: vi.fn() },
  },
}));

describe("Comments API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/tasks/[id]/comments", () => {
    it("should return comments for project viewers", async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ projectId: "proj-1" } as any);
      vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "viewer" });
      
      const mockComments = [{ id: "c1", body: "hello", author: { name: "Test" } }];
      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockComments as any);

      const req = new NextRequest("http://localhost:3000/api/tasks/task-1/comments");
      const res = await GET(req, { params: Promise.resolve({ id: "task-1" }) });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.comments).toEqual(mockComments);
    });
  });

  describe("POST /api/tasks/[id]/comments", () => {
    it("should reject posting for viewers", async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ projectId: "proj-1" } as any);
      vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "viewer" });
      vi.mocked(auth.canEditTasks).mockReturnValue(false);
      vi.mocked(auth.forbidden).mockImplementation((msg) => new Response(JSON.stringify({ error: msg }), { status: 403 }) as any);

      const req = new NextRequest("http://localhost:3000/api/tasks/task-1/comments", {
        method: "POST",
        body: JSON.stringify({ body: "This should fail" }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: "task-1" }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("viewers cannot post comments");
    });

    it("should allow posting for members", async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
      vi.mocked(prisma.task.findUnique).mockResolvedValue({ projectId: "proj-1" } as any);
      vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "member" });
      vi.mocked(auth.canEditTasks).mockReturnValue(true);
      
      const newComment = { id: "c2", body: "Hello World", authorId: "user-1" };
      vi.mocked(prisma.comment.create).mockResolvedValue(newComment as any);

      const req = new NextRequest("http://localhost:3000/api/tasks/task-1/comments", {
        method: "POST",
        body: JSON.stringify({ body: "Hello World" }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: "task-1" }) });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.comment.body).toBe("Hello World");
      expect(prisma.comment.create).toHaveBeenCalled();
    });
  });
});
