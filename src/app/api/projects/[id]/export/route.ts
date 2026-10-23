import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  getProjectMembership,
  canEditTasks, // canEditTasks essentially means admin or member
} from "@/lib/auth";
import { exportTaskToAirtable } from "@/lib/airtable";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) return notFound("project not found");

  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) {
    return forbidden("only project admins and members can export tasks");
  }

  // Fetch all tasks for the project
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { name: true } },
    },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ message: "No tasks to export", successCount: 0, failCount: 0 });
  }

  let successCount = 0;
  let failCount = 0;

  // Export tasks (synchronously or asynchronously). Requirements say "synchronous is fine (async earns bonus)".
  // We'll process them in batches or sequentially. We use Promise.all for some concurrency but map it safely.
  await Promise.all(
    tasks.map(async (task) => {
      const result = await exportTaskToAirtable({
        id: task.id,
        title: task.title,
        description: task.description || "",
        status: task.status,
        assignee: task.assignee?.name || null,
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    })
  );

  return NextResponse.json({ successCount, failCount, total: tasks.length });
}
