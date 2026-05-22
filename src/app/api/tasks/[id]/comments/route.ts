import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  getProjectMembership,
  canPostComments,
} from "@/lib/auth";
import { createCommentSchema } from "@/schemas/comment";

type Params = { params: Promise<{ id: string }> };

const authorSelect = { id: true, name: true, email: true } as const;

async function getTaskWithMembership(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });
  if (!task) return { error: notFound("task not found") as const };

  const membership = await getProjectMembership(userId, task.projectId);
  if (!membership) {
    return { error: forbidden("you are not a member of this project") as const };
  }

  return { task, membership };
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: taskId } = await params;
  const result = await getTaskWithMembership(user.id, taskId);
  if ("error" in result) return result.error;

  const comments = await prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: authorSelect } },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: taskId } = await params;
  const result = await getTaskWithMembership(user.id, taskId);
  if ("error" in result) return result.error;

  if (!canPostComments(result.membership.role)) {
    return forbidden("viewers cannot post comments");
  }

  const body = await req.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      authorId: user.id,
      body: parsed.data.body.trim(),
    },
    include: { author: { select: authorSelect } },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
