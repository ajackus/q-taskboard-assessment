import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

// The route talks to the DB and to the auth helpers; stub both so we can assert
// how the search query is built without a live Postgres.
vi.mock("@/lib/prisma", () => ({
  prisma: { task: { findMany: vi.fn() } },
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    getProjectMembership: vi.fn(),
  };
});

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getProjectMembership } from "@/lib/auth";
import { GET } from "@/app/api/projects/[id]/tasks/route";

const findMany = vi.mocked(prisma.task.findMany);

function get(projectId: string, q?: string) {
  const url = new URL(`http://localhost/api/projects/${projectId}/tasks`);
  if (q !== undefined) url.searchParams.set("q", q);
  return GET(new NextRequest(url), { params: Promise.resolve({ id: projectId }) });
}

describe("GET /api/projects/[id]/tasks — search is injection-safe", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", email: "a@b.com", name: "A" });
    vi.mocked(getProjectMembership).mockResolvedValue({ role: "member" } as never);
    findMany.mockReset();
    findMany.mockResolvedValue([] as never);
  });

  it("passes a SQL-injection payload as a parameterized `contains` filter, never raw SQL", async () => {
    const evil = `zzz%') UNION SELECT id, email, password_hash, name, 'todo'::"TaskStatus", NULL, id, 0, created_at, updated_at FROM users -- `;
    const res = await get("p1", evil);
    expect(res.status).toBe(200);

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0]!;
    // scoped to the project, and the attacker string is treated as literal data
    expect(arg.where).toMatchObject({
      projectId: "p1",
      OR: [
        { title: { contains: evil, mode: "insensitive" } },
        { description: { contains: evil, mode: "insensitive" } },
      ],
    });
  });

  it("omits the OR filter entirely when no q is given", async () => {
    await get("p1");
    const arg = findMany.mock.calls[0][0]!;
    expect(arg.where).toEqual({ projectId: "p1" });
  });

  it("regression guard: the route source uses no raw SQL", () => {
    const src = readFileSync("src/app/api/projects/[id]/tasks/route.ts", "utf8");
    expect(src).not.toContain("$queryRaw");
    expect(src).not.toContain("$queryRawUnsafe");
  });
});
