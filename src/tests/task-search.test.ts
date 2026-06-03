import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn() },
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/projects/[id]/tasks/route";

const TOKEN = signToken({ userId: "u1", email: "user@test.com" });
const MOCK_USER = { id: "u1", email: "user@test.com", name: "Test User" };
const MOCK_MEMBERSHIP = { role: "member" };
const MOCK_TASKS = [
  { id: "t1", title: "Fix login bug", description: "auth issue", status: "todo", position: 0, assignee: null },
  { id: "t2", title: "Add tests", description: "write more tests", status: "todo", position: 1, assignee: null },
];

const PARAMS = { params: Promise.resolve({ id: "proj_1" }) };

function getRequest(query?: string) {
  const url = query
    ? `http://localhost/api/projects/proj_1/tasks?q=${encodeURIComponent(query)}`
    : "http://localhost/api/projects/proj_1/tasks";
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

describe("GET /api/projects/[id]/tasks — Issue #2 SQL injection fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_MEMBERSHIP);
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_TASKS);
  });

  it("returns 403 for non-members", async () => {
    (prisma.membership.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(getRequest("bug"), PARAMS);
    expect(res.status).toBe(403);
  });

  it("returns tasks for a normal search query", async () => {
    const res = await GET(getRequest("bug"), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toEqual(MOCK_TASKS);
  });

  it("calls prisma.task.findMany with parameterised OR filter when ?q is given", async () => {
    await GET(getRequest("login"), PARAMS);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "proj_1",
          OR: [
            { title: { contains: "login", mode: "insensitive" } },
            { description: { contains: "login", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("passes SQL metacharacters safely as a literal value (no injection)", async () => {
    const malicious = "'; DROP TABLE tasks; --";
    await GET(getRequest(malicious), PARAMS);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: malicious, mode: "insensitive" } },
            { description: { contains: malicious, mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("passes UNION injection attempt safely as a literal value", async () => {
    const malicious = "' UNION SELECT id,email,passwordHash FROM users--";
    await GET(getRequest(malicious), PARAMS);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: malicious, mode: "insensitive" } },
            { description: { contains: malicious, mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("returns all tasks without OR filter when no ?q is provided", async () => {
    await GET(getRequest(), PARAMS);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "proj_1" },
      })
    );
  });

  it("returns 401 when no token supplied", async () => {
    const req = new NextRequest("http://localhost/api/projects/proj_1/tasks");
    const res = await GET(req, PARAMS);
    expect(res.status).toBe(401);
  });
});
