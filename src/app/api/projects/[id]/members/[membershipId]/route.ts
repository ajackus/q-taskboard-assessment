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
import { updateMembershipSchema } from "@/schemas/membership";

type Params = { params: Promise<{ id: string; membershipId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId, membershipId } = await params;
  const callerMembership = await getProjectMembership(user.id, projectId);
  if (!callerMembership) return forbidden("you are not a member of this project");
  if (!canEditProject(callerMembership.role)) {
    return forbidden("only project admins can manage members");
  }

  const body = await req.json().catch(() => null);
  const parsed = updateMembershipSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const existing = await prisma.membership.findFirst({
    where: { id: membershipId, projectId },
  });
  if (!existing) return notFound("membership not found");
  if (existing.role === "admin") {
    return forbidden("admin memberships cannot be changed");
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ membership: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId, membershipId } = await params;
  const callerMembership = await getProjectMembership(user.id, projectId);
  if (!callerMembership) return forbidden("you are not a member of this project");
  if (!canEditProject(callerMembership.role)) {
    return forbidden("only project admins can manage members");
  }

  const existing = await prisma.membership.findFirst({
    where: { id: membershipId, projectId },
  });
  if (!existing) return notFound("membership not found");
  if (existing.role === "admin") {
    return forbidden("admin memberships cannot be removed");
  }

  const adminCount = await prisma.membership.count({
    where: { projectId, role: "admin" },
  });
  if (adminCount < 1) {
    return badRequest("cannot remove the last admin from the project");
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  return NextResponse.json({ ok: true });
}
