import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/[id]/export/route";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { airtable } from "@/lib/airtable-mock";

describe("Airtable Export API", () => {
  let memberToken: string;
  let viewerToken: string;
  let projectId: string;

  beforeAll(async () => {
    airtable.__reset();

    const member = await prisma.user.create({
      data: { email: "exportmember@c.com", name: "Member", passwordHash: "dummy" },
    });
    const viewer = await prisma.user.create({
      data: { email: "exportviewer@c.com", name: "Viewer", passwordHash: "dummy" },
    });

    memberToken = signToken({ userId: member.id, email: member.email });
    viewerToken = signToken({ userId: viewer.id, email: viewer.email });

    const project = await prisma.project.create({
      data: {
        name: "Export Project",
        ownerId: member.id,
        memberships: {
          create: [
            { userId: member.id, role: "member" },
            { userId: viewer.id, role: "viewer" },
          ],
        },
      },
    });
    projectId = project.id;

    await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Test Export Task",
        createdById: member.id,
      },
    });
  });

  afterAll(() => {
    airtable.__reset();
  });

  it("prevents viewers from exporting", async () => {
    const req = new NextRequest(`http://localhost/api/projects/${projectId}/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${viewerToken}` },
    });

    const res = await POST(req, { params: Promise.resolve({ id: projectId }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("only project admins and members can export tasks");
  });

  it("allows member to export and handles retries with mock", async () => {
    // We simulate failure rate. Since max retries is 3, 
    // a 100% failure rate will cause it to ultimately fail.
    // Let's test success first.
    airtable.__setFailureRate(0);

    const req = new NextRequest(`http://localhost/api/projects/${projectId}/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    const res = await POST(req, { params: Promise.resolve({ id: projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.successCount).toBe(1);
    expect(data.failCount).toBe(0);
    expect(data.total).toBe(1);

    const records = airtable.__getRecords();
    expect(records.length).toBe(1);
    expect(records[0].fields.Title).toBe("Test Export Task");
  });

  it("handles persistent failures gracefully", async () => {
    // 100% failure rate
    airtable.__setFailureRate(1, "server-error");

    const req = new NextRequest(`http://localhost/api/projects/${projectId}/export`, {
      method: "POST",
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    const res = await POST(req, { params: Promise.resolve({ id: projectId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.successCount).toBe(0);
    expect(data.failCount).toBe(1);
  }, 15000); // Allow longer timeout because it will sleep during retries
});
