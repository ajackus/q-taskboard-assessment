import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  getProjectMembership,
} from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAirtableClient } from "@/lib/airtable";
import { exportTasksToAirtable } from "@/lib/airtable-export";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return notFound("project not found");

  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!can(membership.role, "export:run")) {
    return forbidden("viewers cannot export this project");
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      assignee: { select: { email: true } },
    },
  });

  const client = getAirtableClient();
  const summary = await exportTasksToAirtable(
    client,
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      assigneeEmail: t.assignee?.email ?? null,
      createdAt: t.createdAt.toISOString(),
    }))
  );

  return NextResponse.json(summary);
}
