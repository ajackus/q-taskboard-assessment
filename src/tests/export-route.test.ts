import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    task: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getProjectMembership: vi.fn(),
  };
});

vi.mock("@/lib/airtable", () => ({
  getAirtableClient: vi.fn(() => "fake-client"),
}));

vi.mock("@/lib/airtable-export", () => ({
  exportTasksToAirtable: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getProjectMembership } from "@/lib/auth";
import { exportTasksToAirtable } from "@/lib/airtable-export";
import { POST } from "@/app/api/projects/[id]/export/route";

const mockUser = { id: "u1", email: "a@b.com", name: "A" };

function makeRequest(url: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
  });
}

describe("POST /api/projects/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (prisma.project.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "p1",
    });
    (prisma.task.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "t1",
        title: "task one",
        description: "some detail",
        status: "todo",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        assignee: { email: "a@b.com" },
      },
    ]);
    (exportTasksToAirtable as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      exported: 1,
      updated: 0,
      failed: [],
    });
  });

  it("returns 404 when the project doesn't exist", async () => {
    (prisma.project.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    const res = await POST(makeRequest("http://localhost/api/projects/missing/export"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(res.status).toBe(404);
    expect(exportTasksToAirtable).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-member", async () => {
    (getProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/projects/p1/export"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(403);
    expect(exportTasksToAirtable).not.toHaveBeenCalled();
  });

  it("returns 403 for a viewer", async () => {
    (getProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "viewer",
    });
    const res = await POST(makeRequest("http://localhost/api/projects/p1/export"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(403);
    expect(exportTasksToAirtable).not.toHaveBeenCalled();
  });

  it("runs the export for a member and returns the summary", async () => {
    (getProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "member",
    });
    const res = await POST(makeRequest("http://localhost/api/projects/p1/export"), {
      params: Promise.resolve({ id: "p1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ exported: 1, updated: 0, failed: [] });
    expect(exportTasksToAirtable).toHaveBeenCalledWith(
      "fake-client",
      [
        {
          id: "t1",
          title: "task one",
          description: "some detail",
          status: "todo",
          assigneeEmail: "a@b.com",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]
    );
  });

  it("runs the export for an admin", async () => {
    (getProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "admin",
    });
    const res = await POST(makeRequest("http://localhost/api/projects/p1/export"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(200);
    expect(exportTasksToAirtable).toHaveBeenCalled();
  });
});
