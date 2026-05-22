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
import { exportProjectTasks } from "@/lib/airtable-export";

type Params = { params: Promise<{ id: string }> };

/**
 * Export all tasks from a project to Airtable.
 *
 * Authorization:
 * - User must be authenticated
 * - User must be a member of the project
 * - User must have admin or member role (viewers cannot export)
 *
 * Response:
 * - 201: Export successful (or partial success with errors)
 * - 401: Not authenticated
 * - 403: Not a member or insufficient permissions
 * - 404: Project not found
 * - 503: Airtable service error (partial results still returned)
 */
export async function POST(req: NextRequest, { params }: Params) {
  console.log("[ExportAPI] Export endpoint called");

  const user = await getCurrentUser(req);
  console.log("[ExportAPI] User:", user?.email);
  if (!user) {
    console.log("[ExportAPI] No user, returning 401");
    return unauthorized();
  }

  const { id: projectId } = await params;
  console.log("[ExportAPI] Project ID:", projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  console.log("[ExportAPI] Project found:", project?.name);
  if (!project) {
    console.log("[ExportAPI] Project not found");
    return notFound("project not found");
  }

  const membership = await getProjectMembership(user.id, projectId);
  console.log("[ExportAPI] Membership:", membership?.role);
  if (!membership) {
    console.log("[ExportAPI] Not a member");
    return forbidden("you are not a member of this project");
  }

  if (!canEditTasks(membership.role)) {
    console.log("[ExportAPI] Insufficient role:", membership.role);
    return forbidden("viewers cannot export tasks");
  }

  console.log("[ExportAPI] Authorization passed, starting export...");
  const exportResult = await exportProjectTasks(projectId, project.name);

  console.log("[ExportAPI] Export result:", {
    success: exportResult.success,
    exported: exportResult.exported,
    failed: exportResult.failed,
  });

  const statusCode = exportResult.success ? 201 : 503;
  return NextResponse.json(exportResult, { status: statusCode });
}
