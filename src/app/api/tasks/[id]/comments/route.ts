import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  getProjectMembership,
  canEditTasks,
} from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });
  if (!task) return notFound("task not found");

  const membership = await getProjectMembership(user.id, task.projectId);
  if (!membership) return forbidden("you are not a member of this project");

  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });
  if (!task) return notFound("task not found");

  const membership = await getProjectMembership(user.id, task.projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) {
    return forbidden("viewers cannot post comments");
  }

  const payload = await req.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(payload);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const comment = await prisma.comment.create({
    data: {
      taskId,
      authorId: user.id,
      body: parsed.data.body,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
