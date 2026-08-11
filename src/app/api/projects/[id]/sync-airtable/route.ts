import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  getProjectMembership,
} from "@/lib/auth";
import { syncTasksToAirtable, REQUIRED_COLUMNS } from "@/lib/airtable-sync";
import type { ApiTask } from "@/types";

type Params = { params: Promise<{ id: string }> };

// ponytail: syncs inline and returns the summary. Fine for a project's task
// count; if a base grows to thousands of rows, move to a background job +
// status-polling endpoint instead of holding the request open.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;
  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: { assignee: { select: { id: true, name: true, email: true } } },
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });

  const result = await syncTasksToAirtable(tasks as unknown as ApiTask[]);
  return NextResponse.json({ ...result, requiredColumns: REQUIRED_COLUMNS });
}
