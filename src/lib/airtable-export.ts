import { prisma } from "./prisma";
import { airtable, AirtableTaskFields } from "./airtable";
import type { Task } from "@prisma/client";

export type ExportResult = {
  success: boolean;
  totalTasks: number;
  exported: number;
  failed: number;
  errors: Array<{ taskId: string; title: string; error: string }>;
  message: string;
};

/**
 * Export all tasks from a project to Airtable.
 *
 * Features:
 * - Fetches all tasks from the project
 * - Maps task fields to Airtable schema
 * - Creates or updates records (idempotent via task ID)
 * - Handles per-record failures gracefully
 * - Single task failure doesn't block export
 *
 * Idempotency:
 * - Task ID used as Airtable record ID
 * - Multiple exports produce same records (upsert semantics)
 * - Safe to run repeatedly
 */
export async function exportProjectTasks(
  projectId: string,
  projectName: string
): Promise<ExportResult> {
  console.log("[ExportService] Starting export for project:", {
    projectId,
    projectName,
  });

  if (!airtable.isConfigured()) {
    console.error(
      "[ExportService] Airtable is not configured"
    );
    return {
      success: false,
      totalTasks: 0,
      exported: 0,
      failed: 0,
      errors: [
        {
          taskId: "N/A",
          title: "Configuration Error",
          error:
            "Airtable is not configured. Set AIRTABLE_API_KEY, AIRTABLE_BASE_ID in .env",
        },
      ],
      message: "Airtable export is not configured",
    };
  }

  try {
    console.log("[ExportService] Fetching tasks from database...");
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { position: "asc" },
    });

    console.log(`[ExportService] Found ${tasks.length} tasks to export`);
    if (tasks.length === 0) {
      console.log("[ExportService] No tasks to export");
    }

    const errors: Array<{
      taskId: string;
      title: string;
      error: string;
    }> = [];
    let exported = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(
        `[ExportService] Exporting task ${i + 1}/${tasks.length}: ${task.id}`
      );
      const result = await exportTask(task);

      if (result.success) {
        exported++;
        console.log(
          `[ExportService] Task ${task.id} exported successfully`
        );
      } else {
        console.error(`[ExportService] Task ${task.id} failed:`, result.error);
        errors.push({
          taskId: task.id,
          title: task.title,
          error: result.error || "Unknown error",
        });
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `Successfully exported ${exported} task${exported !== 1 ? "s" : ""} to Airtable`
      : `Exported ${exported}/${tasks.length} tasks. ${errors.length} failed.`;

    console.log("[ExportService] Export complete:", {
      success,
      exported,
      failed: errors.length,
      message,
    });

    return {
      success,
      totalTasks: tasks.length,
      exported,
      failed: errors.length,
      errors,
      message,
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error during export";
    console.error("[ExportService] Unexpected error:", {
      error: err,
      message: errorMsg,
    });

    return {
      success: false,
      totalTasks: 0,
      exported: 0,
      failed: 1,
      errors: [
        {
          taskId: "N/A",
          title: "Export Service Error",
          error: errorMsg,
        },
      ],
      message: `Export failed: ${errorMsg}`,
    };
  }
}

/**
 * Export a single task to Airtable.
 * Returns success/error status for this task.
 */
async function exportTask(
  task: Task & { assignee: { name: string } | null; createdBy: { name: string } }
): Promise<{ success: boolean; error?: string }> {
  console.log(`[ExportTask] Preparing fields for task ${task.id}:`, task.title);

  const fields: AirtableTaskFields = {
    TaskId: task.id,
    Name: task.title,
    Description: task.description || undefined,
    Status: task.status,
    AssigneeId: task.assigneeId || undefined,
    CreatedById: task.createdById,
    Position: task.position,
    CreatedAt: task.createdAt.toISOString(),
    UpdatedAt: task.updatedAt.toISOString(),
  };

  console.log(`[ExportTask] Fields prepared:`, {
    TaskId: task.id,
    Name: fields.Name,
    Status: fields.Status,
    CreatedById: fields.CreatedById,
  });

  console.log(`[ExportTask] Calling airtable.createOrUpdateTask...`);
  const result = await airtable.createOrUpdateTask(task.id, fields);
  console.log(`[ExportTask] Result for ${task.id}:`, result);

  return result;
}
