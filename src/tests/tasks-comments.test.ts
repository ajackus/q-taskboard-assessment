import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tasks/[id]/comments/route";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";

describe("Task Comments API", () => {
  let memberToken: string;
  let viewerToken: string;
  let taskId: string;

  beforeAll(async () => {
    await prisma.comment.deleteMany();
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    const member = await prisma.user.create({
      data: { email: "member@c.com", name: "Member", passwordHash: "dummy" },
    });
    const viewer = await prisma.user.create({
      data: { email: "viewer@c.com", name: "Viewer", passwordHash: "dummy" },
    });

    memberToken = signToken({ userId: member.id, email: member.email });
    viewerToken = signToken({ userId: viewer.id, email: viewer.email });

    const project = await prisma.project.create({
      data: {
        name: "Comments Project",
        ownerId: member.id,
        memberships: {
          create: [
            { userId: member.id, role: "member" },
            { userId: viewer.id, role: "viewer" },
          ],
        },
      },
    });

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Test Task",
        createdById: member.id,
      },
    });
    taskId = task.id;
  });



  it("allows member to post a comment", async () => {
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}` },
      body: JSON.stringify({ body: "Hello World" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: taskId }) });
    expect(res.status).toBe(201);
    
    const data = await res.json();
    expect(data.comment.body).toBe("Hello World");
  });

  it("prevents viewer from posting a comment", async () => {
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: JSON.stringify({ body: "Viewer tries to post" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: taskId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("viewers cannot post comments");
  });

  it("allows viewer to read comments", async () => {
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
      method: "GET",
      headers: { Authorization: `Bearer ${viewerToken}` },
    });

    const res = await GET(req, { params: Promise.resolve({ id: taskId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.comments.length).toBeGreaterThan(0);
    expect(data.comments[0].body).toBe("Hello World");
  });
});
