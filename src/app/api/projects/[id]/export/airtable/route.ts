import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  getProjectMembership,
  canEditTasks,
} from "@/lib/auth";
import { createAirtableWriter, getAirtableConfig } from "@/lib/airtable-client";
import { exportTasksToAirtable } from "@/lib/airtable-export";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;
  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) {
    return forbidden("viewers cannot export tasks");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) return notFound("project not found");

  let config;
  try {
    config = getAirtableConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Airtable is not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });

  try {
    const writer = createAirtableWriter(config);
    const result = await exportTasksToAirtable({
      tasks,
      projectName: project.name,
      writer,
      baseId: config.baseId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "export failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
