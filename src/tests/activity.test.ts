import { NextRequest } from "next/server";
import { GET } from "../app/api/projects/[id]/activity/route";
import * as auth from "../lib/auth";
import { prisma } from "../lib/prisma";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/auth");
vi.mock("../lib/prisma", () => ({
  prisma: {
    activity: { findMany: vi.fn() },
  },
}));

describe("Activity Feed API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/projects/[id]/activity", () => {
    it("should deny access to non-members", async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
      vi.mocked(auth.getProjectMembership).mockResolvedValue(null);
      vi.mocked(auth.forbidden).mockImplementation((msg) => new Response(JSON.stringify({ error: msg }), { status: 403 }) as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj-1/activity");
      const res = await GET(req, { params: Promise.resolve({ id: "proj-1" }) });
      
      expect(res.status).toBe(403);
    });

    it("should return activities for members", async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" });
      vi.mocked(auth.getProjectMembership).mockResolvedValue({ role: "viewer" });
      
      const mockActivities = [{ id: "act-1", action: "created task", target: "Task 1", user: { name: "Test" } }];
      vi.mocked(prisma.activity.findMany).mockResolvedValue(mockActivities as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj-1/activity");
      const res = await GET(req, { params: Promise.resolve({ id: "proj-1" }) });
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.activities).toEqual(mockActivities);
    });
  });
});
