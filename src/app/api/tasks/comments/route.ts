import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  getProjectMembership,
} from "@/lib/auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  const user = await getCurrentUser(req);

  if (!user) return unauthorized();

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) return notFound("task not found");

  const membership = await getProjectMembership(
    user.id,
    task.projectId
  );

  if (!membership) {
    return forbidden(
      "you are not a member of this project"
    );
  }

  const comments = await prisma.comment.findMany({
    where: {
      taskId: id,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    comments,
  });
}
export async function POST(
  req: NextRequest,
  { params }: Params
) {
  const user = await getCurrentUser(req);

  if (!user) return unauthorized();

  const { id } = await params;

  const body = await req.json();

  if (!body?.body?.trim()) {
    return NextResponse.json(
      {
        error: "Comment is required",
      },
      {
        status: 400,
      }
    );
  }

  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) return notFound("task not found");

  const membership = await getProjectMembership(
    user.id,
    task.projectId
  );

  if (!membership) {
    return forbidden(
      "you are not a member of this project"
    );
  }

  // viewers can only read
  if (membership.role === "viewer") {
    return forbidden(
      "viewers cannot post comments"
    );
  }

  const comment = await prisma.comment.create({
    data: {
      body: body.body,
      taskId: id,
      authorId: user.id,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    comment,
  });
}