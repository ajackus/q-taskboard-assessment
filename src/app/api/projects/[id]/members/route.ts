import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  getProjectMembership,
  canEditProject,
} from "@/lib/auth";
import { createMembershipSchema } from "@/schemas/membership";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;
  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditProject(membership.role)) {
    return forbidden("only project admins can manage members");
  }

  const body = await req.json().catch(() => null);
  const parsed = createMembershipSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!targetUser) return notFound("user not found");

  const existing = await prisma.membership.findUnique({
    where: {
      userId_projectId: { userId: parsed.data.userId, projectId },
    },
  });
  if (existing) return badRequest("user is already a member of this project");

  const created = await prisma.membership.create({
    data: {
      userId: parsed.data.userId,
      projectId,
      role: parsed.data.role,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ membership: created }, { status: 201 });
}
