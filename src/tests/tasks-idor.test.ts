import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/tasks/[id]/route";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";

describe("Tasks API - IDOR fix", () => {
  let adminToken: string;
  let viewerToken: string;
  let taskId: string;

  beforeAll(async () => {
    // Clear out
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create users
    const admin = await prisma.user.create({
      data: { email: "admin@test.com", name: "Admin", passwordHash: "dummy" },
    });
    const viewer = await prisma.user.create({
      data: { email: "viewer@test.com", name: "Viewer", passwordHash: "dummy" },
    });
    const random = await prisma.user.create({
      data: { email: "random@test.com", name: "Random", passwordHash: "dummy" },
    });

    adminToken = signToken({ userId: admin.id, email: admin.email });
    viewerToken = signToken({ userId: viewer.id, email: viewer.email });
    const randomToken = signToken({ userId: random.id, email: random.email });

    // Create project
    const project = await prisma.project.create({
      data: {
        name: "Test Project",
        ownerId: admin.id,
        memberships: {
          create: [
            { userId: admin.id, role: "admin" },
            { userId: viewer.id, role: "viewer" },
          ],
        },
      },
    });

    // Create task
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Original Title",
        createdById: admin.id,
      },
    });
    taskId = task.id;
  });



  it("allows admin to edit the task", async () => {
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ title: "Admin Edited" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: taskId }) });
    expect(res.status).toBe(200);

    const updated = await prisma.task.findUnique({ where: { id: taskId } });
    expect(updated?.title).toBe("Admin Edited");
  });

  it("prevents viewer from editing the task", async () => {
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ title: "Viewer Hacked" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: taskId }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("viewers cannot edit tasks");
  });
});
