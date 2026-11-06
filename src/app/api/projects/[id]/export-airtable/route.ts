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
import { exportTask } from "@/lib/airtable";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;

  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) {
    return forbidden("viewers cannot export to airtable");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: {
        include: {
          assignee: true,
        },
      },
    },
  });

  if (!project) return notFound("project not found");

  let exported = 0;
  let updated = 0;
  let failed = 0;

  for (const task of project.tasks) {
    try {
      const result = await exportTask(task, project);
      if (result === "created") exported++;
      else if (result === "updated") updated++;
    } catch (err) {
      console.error(`Failed to export task ${task.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    exported,
    updated,
    failed,
  });
}
