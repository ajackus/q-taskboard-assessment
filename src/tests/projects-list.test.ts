import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: {
      findMany: vi.fn(),
    },
    project: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/projects/route";

const TOKEN = signToken({ userId: "u1", email: "user@test.com" });
const MOCK_USER = { id: "u1", email: "user@test.com", name: "Test User" };

function getRequest() {
  return new NextRequest("http://localhost/api/projects", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

const MOCK_MEMBERSHIPS = [
  {
    role: "admin",
    createdAt: new Date("2025-01-01"),
    project: {
      id: "proj_1",
      name: "Alpha",
      description: "First project",
      createdAt: new Date("2025-01-01"),
      owner: { id: "u1", name: "Test User", email: "user@test.com" },
      _count: { tasks: 42 },
    },
  },
  {
    role: "member",
    createdAt: new Date("2025-02-01"),
    project: {
      id: "proj_2",
      name: "Beta",
      description: null,
      createdAt: new Date("2025-02-01"),
      owner: { id: "u2", name: "Owner Two", email: "owner2@test.com" },
      _count: { tasks: 7 },
    },
  },
];

describe("GET /api/projects — Issue #4 performance fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MEMBERSHIPS);
  });

  it("returns 200 with projects list", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(200);
  });

  it("returns taskCount derived from _count.tasks (not tasks.length)", async () => {
    const res = await GET(getRequest());
    const body = await res.json();
    expect(body.projects[0].taskCount).toBe(42);
    expect(body.projects[1].taskCount).toBe(7);
  });

  it("does NOT include a raw tasks array in the response", async () => {
    const res = await GET(getRequest());
    const body = await res.json();
    expect(body.projects[0].tasks).toBeUndefined();
  });

  it("queries membership with take: 50 to limit over-fetching", async () => {
    await GET(getRequest());
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it("includes _count.tasks in the Prisma include (not tasks: true)", async () => {
    await GET(getRequest());
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          project: expect.objectContaining({
            include: expect.objectContaining({
              _count: { select: { tasks: true } },
            }),
          }),
        }),
      })
    );
  });

  it("returns 401 when no token is supplied", async () => {
    const req = new NextRequest("http://localhost/api/projects");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
