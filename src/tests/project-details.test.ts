import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjectMembership: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getProjectMembership: mocks.getProjectMembership,
  unauthorized: vi.fn(),
  forbidden: vi.fn(),
  notFound: vi.fn(),
  badRequest: vi.fn(),
  canEditProject: vi.fn(),
}));

import { GET } from "@/app/api/projects/[id]/route";

const publicUserSelect = { id: true, name: true, email: true };

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "member@example.test",
      name: "Project Member",
    });
    mocks.getProjectMembership.mockResolvedValue({ role: "member" });
    mocks.findUnique.mockResolvedValue({
      id: "project-1",
      name: "Test Project",
      description: null,
      ownerId: "owner-1",
      owner: { id: "owner-1", name: "Owner", email: "owner@example.test" },
      memberships: [{
        id: "membership-1",
        role: "member",
        user: { id: "user-1", name: "Project Member", email: "member@example.test" },
      }],
      tasks: [{
        id: "task-1",
        title: "Test task",
        assignee: { id: "user-1", name: "Project Member", email: "member@example.test" },
        createdBy: { id: "owner-1", name: "Owner", email: "owner@example.test" },
      }],
    });
  });

  it("does not include password hashes in the response or fetch them from user relations", async () => {
    const request = new NextRequest("http://localhost/api/projects/project-1", {
      headers: { authorization: "Bearer test-token" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(body.project.owner.name).toBe("Owner");
    expect(body.project.memberships[0].user.name).toBe("Project Member");
    expect(body.project.tasks[0].assignee.name).toBe("Project Member");

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "project-1" },
      include: {
        owner: { select: publicUserSelect },
        memberships: {
          include: { user: { select: publicUserSelect } },
        },
        tasks: {
          include: {
            assignee: { select: publicUserSelect },
            createdBy: { select: publicUserSelect },
          },
          orderBy: [{ status: "asc" }, { position: "asc" }],
        },
      },
    });
  });
});
