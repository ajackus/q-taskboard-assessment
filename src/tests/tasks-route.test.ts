import { NextRequest } from "next/server";
import { PATCH } from "../app/api/tasks/[id]/route";
import * as auth from "../lib/auth";
import { prisma } from "../lib/prisma";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../lib/auth");
vi.mock("../lib/prisma", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("PATCH /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return 403 if user is not a member of the project", async () => {
    // Setup mocks
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", projectId: "proj-1", title: "Test", description: null, status: "todo", assigneeId: null, createdById: "user-2", position: 0, createdAt: new Date(), updatedAt: new Date() });
    
    // User is NOT a member
    vi.mocked(auth.getProjectMembership).mockResolvedValue(null);
    vi.mocked(auth.forbidden).mockImplementation((msg) => new Response(JSON.stringify({ error: msg }), { status: 403 }) as any);

    const req = new NextRequest("http://localhost:3000/api/tasks/task-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Hacked Title!" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "task-1" }) });
    
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("you are not a member of this project");
  });

  it("should return 403 if user is a viewer", async () => {
    // Setup mocks
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", projectId: "proj-1", title: "Test", description: null, status: "todo", assigneeId: null, createdById: "user-2", position: 0, createdAt: new Date(), updatedAt: new Date() });
    
    // User is a viewer
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "viewer" });
    vi.mocked(auth.canEditTasks).mockReturnValue(false);
    vi.mocked(auth.forbidden).mockImplementation((msg) => new Response(JSON.stringify({ error: msg }), { status: 403 }) as any);

    const req = new NextRequest("http://localhost:3000/api/tasks/task-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Hacked Title!" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "task-1" }) });
    
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("viewers cannot edit tasks");
  });

  it("should return 200 and update task if user is an admin or member", async () => {
    // Setup mocks
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
    vi.mocked(prisma.task.findUnique).mockResolvedValue({ id: "task-1", projectId: "proj-1", title: "Test", description: null, status: "todo", assigneeId: null, createdById: "user-2", position: 0, createdAt: new Date(), updatedAt: new Date() });
    
    // User is an admin
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "admin" });
    vi.mocked(auth.canEditTasks).mockReturnValue(true);
    
    const updatedTask = { id: "task-1", projectId: "proj-1", title: "New Title", description: null, status: "todo", assigneeId: null, createdById: "user-2", position: 0, createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(prisma.task.update).mockResolvedValue(updatedTask);

    // Provide a mocked Response for NextResponse.json inside the handler
    const req = new NextRequest("http://localhost:3000/api/tasks/task-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "task-1" }) });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.title).toBe("New Title");
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "task-1" },
      data: { title: "New Title" }
    }));
  });
});
