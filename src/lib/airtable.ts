import Airtable from "airtable";
import { airtable as mockAirtable } from "./airtable-mock";

// If we are in test mode, we use the mock.
export const isTest = process.env.NODE_ENV === "test";

// Initialize the real client.
const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_API_KEY;

const realAirtable = baseId && apiKey ? new Airtable({ apiKey }).base(baseId) : null;

// Transient error check for real Airtable API (e.g. 429 Too Many Requests, 5xx Server Errors)
function isTransientError(error: any) {
  if (!error) return false;
  const status = error.statusCode || error.status;
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function exportTaskToAirtable(task: {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee: string | null;
}, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (isTest) {
        await mockAirtable.create({
          id: task.id,
          fields: {
            "Task ID": task.id,
            "Title": task.title,
            "Description": task.description ?? "",
            "Status": task.status,
            "Assignee": task.assignee ?? "Unassigned",
          },
        });
        return { success: true };
      } else {
        if (!realAirtable) {
          throw new Error("Airtable is not configured");
        }
        
        // Use task.id to find existing record? Airtable doesn't have native upsert by arbitrary field unless you use the API carefully.
        // Wait, the assignment says: "The export must handle being run more than once gracefully" (Idempotency).
        // Since Airtable JS doesn't have an easy "upsert by field" in older versions, let's search by Task ID, then update or create.
        
        const table = realAirtable("Tasks");
        const existingRecords = await table.select({
          filterByFormula: `{Task ID} = '${task.id}'`,
          maxRecords: 1,
        }).firstPage();

        const fields = {
          "Task ID": task.id,
          "Title": task.title,
          "Description": task.description ?? "",
          "Status": task.status,
          "Assignee": task.assignee ?? "Unassigned",
        };

        if (existingRecords.length > 0) {
          await table.update(existingRecords[0].id, fields);
        } else {
          await table.create(fields);
        }

        return { success: true };
      }
    } catch (error: any) {
      // In test mode, we might throw AirtableError from mock
      const transient = isTest ? error?.type === "rate-limit" || error?.type === "network" || error?.type === "server-error" : isTransientError(error);

      if (transient && attempt < maxRetries - 1) {
        attempt++;
        await sleep(1000 * attempt); // exponential backoff
        continue;
      }
      
      // Permanent error or max retries reached. Do not fail the entire export, just return failure for this task.
      console.error(`Failed to export task ${task.id}:`, error?.message || error);
      return { success: false, error: error?.message };
    }
  }
}
