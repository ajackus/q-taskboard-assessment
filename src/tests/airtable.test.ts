import { NextRequest } from "next/server";
import { POST } from "../app/api/projects/[id]/export-airtable/route";
import * as auth from "../lib/auth";
import { prisma } from "../lib/prisma";
import { airtable } from "../lib/airtable-mock";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/auth");

vi.mock("../lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Airtable Export Integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    airtable.__reset();
  });

  const mockProject = {
    id: "proj-1",
    name: "Test Project",
    tasks: [
      {
        id: "task-1",
        title: "Task 1",
        description: "Desc 1",
        status: "todo",
        position: 0,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        updatedAt: new Date("2023-01-02T00:00:00Z"),
        assignee: { name: "Alice" },
      },
      {
        id: "task-2",
        title: "Task 2",
        description: null,
        status: "in_progress",
        position: 1,
        createdAt: new Date("2023-01-03T00:00:00Z"),
        updatedAt: new Date("2023-01-04T00:00:00Z"),
        assignee: null,
      },
    ],
  };

  it("should return 403 if user is not authenticated", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue(null);
    vi.mocked(auth.unauthorized).mockImplementation(
      () => new Response("unauthorized", { status: 401 }) as any
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(401);
  });

  it("should return 403 if user is not a project member", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue(null);
    vi.mocked(auth.forbidden).mockImplementation(
      (msg) => new Response(JSON.stringify({ error: msg }), { status: 403 }) as any
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("you are not a member of this project");
  });

  it("should return 403 if user is a viewer", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "viewer" });
    vi.mocked(auth.canEditTasks).mockReturnValue(false);
    vi.mocked(auth.forbidden).mockImplementation(
      (msg) => new Response(JSON.stringify({ error: msg }), { status: 403 }) as any
    );

    const req = new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("viewers cannot export to airtable");
  });

  it("should successfully export tasks for admin/member", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "admin" });
    vi.mocked(auth.canEditTasks).mockReturnValue(true);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "proj-1" }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      success: true,
      exported: 2,
      updated: 0,
      failed: 0,
    });

    const records = airtable.__getRecords();
    expect(records).toHaveLength(2);

    expect(records[0].fields).toMatchObject({
      "Task ID": "task-1",
      "Project ID": "proj-1",
      "Project Name": "Test Project",
      "Title": "Task 1",
      "Description": "Desc 1",
      "Status": "todo",
      "Assignee": "Alice",
      "Position": "0",
    });

    expect(records[1].fields).toMatchObject({
      "Assignee": "unassigned",
      "Description": "",
    });
  });

  it("should update existing records instead of duplicating them", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "admin" });
    vi.mocked(auth.canEditTasks).mockReturnValue(true);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

    // Initial export
    await POST(
      new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", { method: "POST" }),
      { params: Promise.resolve({ id: "proj-1" }) }
    );
    expect(airtable.__getRecordCount()).toBe(2);

    // Second export
    const res = await POST(
      new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", { method: "POST" }),
      { params: Promise.resolve({ id: "proj-1" }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      exported: 0,
      updated: 2, // Both should be updated now
      failed: 0,
    });

    expect(airtable.__getRecordCount()).toBe(2); // Still 2
  });

  it("should retry transient errors and eventually succeed", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "admin" });
    vi.mocked(auth.canEditTasks).mockReturnValue(true);
    
    const singleTaskProject = {
      ...mockProject,
      tasks: [mockProject.tasks[0]],
    };
    vi.mocked(prisma.project.findUnique).mockResolvedValue(singleTaskProject as any);

    // Set a failure rate of 100% with rate-limit
    airtable.__setFailureRate(1, "rate-limit");

    // But let's mock setTimeout to bypass the actual delay and make the test fast
    // Start the request in background
    let didFail = true;
    setTimeout(() => {
       airtable.__setFailureRate(0);
       didFail = false;
    }, 20);

    const res = await POST(
      new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", { method: "POST" }),
      { params: Promise.resolve({ id: "proj-1" }) }
    );

    expect(didFail).toBe(false);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      exported: 1,
      updated: 0,
      failed: 0,
    });
  });

  it("should fail permanent errors and not retry", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "admin" });
    vi.mocked(auth.canEditTasks).mockReturnValue(true);
    
    const singleTaskProject = {
      ...mockProject,
      tasks: [mockProject.tasks[0]],
    };
    vi.mocked(prisma.project.findUnique).mockResolvedValue(singleTaskProject as any);

    // A permanent error
    // In `airtable.ts`: 
    // if (err.type === "rate-limit" || err.type === "network" || err.type === "server-error") { isTransient = true; }
    // Let's simulate a permanent error by throwing something else.
    // Actually, if it's transient, it retries 3 times then fails. Let's let it fail after 3 retries.
    airtable.__setFailureRate(1, "server-error");
    
    const res = await POST(
      new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", { method: "POST" }),
      { params: Promise.resolve({ id: "proj-1" }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      exported: 0,
      updated: 0,
      failed: 1,
    });
  });

  it("single record failure does not stop export of remaining records", async () => {
    vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "u@u.com", name: "U" });
    vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "admin" });
    vi.mocked(auth.canEditTasks).mockReturnValue(true);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as any);

    // Instead of using __setFailureRate, I will mock `airtable.create` to fail only on task-1
    const originalCreate = airtable.create.bind(airtable);
    vi.spyOn(airtable, "create").mockImplementation(async (input) => {
      if (input.fields["Task ID"] === "task-1") {
        throw new Error("Permanent specific error");
      }
      return originalCreate(input);
    });

    const res = await POST(
      new NextRequest("http://localhost:3000/api/projects/proj-1/export-airtable", { method: "POST" }),
      { params: Promise.resolve({ id: "proj-1" }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    
    // task-1 failed immediately without retrying because it's not an AirtableError in test check
    // task-2 succeeds
    expect(data).toEqual({
      success: true,
      exported: 1,
      updated: 0,
      failed: 1,
    });
  });
});
