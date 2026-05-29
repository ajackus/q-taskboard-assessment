import { prisma } from "./prisma";

/**
 * Logs an activity to the database on a "best-effort" basis.
 * If the write fails, it catches the error and avoids throwing,
 * so the main transaction or request can still succeed.
 */
export async function logActivity(
  projectId: string,
  userId: string,
  action: string,
  target: string
) {
  try {
    await prisma.activity.create({
      data: {
        projectId,
        userId,
        action,
        target,
      },
    });
  } catch (err) {
    // In production, this would be logged to Datadog, Sentry, etc.
    console.error("Failed to log activity:", err);
  }
}
