import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    task: {
      findMany: vi.fn(),
    },
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

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getProjectMembership } from "@/lib/auth";
import { GET } from "@/app/api/projects/[id]/tasks/route";

const mockUser = { id: "u1", email: "a@b.com", name: "A" };

function makeRequest(url: string) {
  return new NextRequest(url, { headers: { authorization: "Bearer test-token" } });
}

describe("GET /api/projects/[id]/tasks — search (SQL injection fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: "member",
    });
    (prisma.task.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("never invokes $queryRawUnsafe for a normal search", async () => {
    const req = makeRequest("http://localhost/api/projects/p1/tasks?q=hello");
    await GET(req, { params: Promise.resolve({ id: "p1" }) });

    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.task.findMany).toHaveBeenCalled();
  });

  it("treats a SQL-injection payload in q as a literal search string, not executable SQL", async () => {
    const payload =
      "nonexistent') UNION SELECT id, email, name, password_hash, 'todo'::\"TaskStatus\", id, id, 0, created_at, updated_at FROM users --";
    const req = makeRequest(
      `http://localhost/api/projects/p1/tasks?q=${encodeURIComponent(payload)}`
    );
    await GET(req, { params: Promise.resolve({ id: "p1" }) });

    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "p1",
          OR: [
            { title: { contains: payload, mode: "insensitive" } },
            { description: { contains: payload, mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("scopes the search to the requested project, ignoring any project_id in the payload", async () => {
    const req = makeRequest(
      "http://localhost/api/projects/p1/tasks?q=' OR project_id='p2"
    );
    await GET(req, { params: Promise.resolve({ id: "p1" }) });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "p1" }),
      })
    );
  });

  it("rejects an overlong q with 400 before touching the database", async () => {
    const req = makeRequest(
      `http://localhost/api/projects/p1/tasks?q=${encodeURIComponent("a".repeat(201))}`
    );
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(400);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-member even when q is present", async () => {
    (getProjectMembership as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/projects/p1/tasks?q=hello");
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(403);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});
