import Airtable from "airtable";
import { airtable as mockAirtable, AirtableError } from "./airtable-mock";

const isTest = process.env.NODE_ENV === "test" || (process.env.NODE_ENV as string) === "test:watch";

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = isTest ? [10, 20, 30] : [500, 1000, 2000];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt >= 3) throw err;

      let isTransient = false;
      if (isTest) {
        if (err instanceof AirtableError) {
          if (err.type === "rate-limit" || err.type === "network" || err.type === "server-error") {
            isTransient = true;
          }
        }
      } else {
        const status = err.statusCode;
        if (
          status === 429 ||
          status >= 500 ||
          err.code === "ETIMEDOUT" ||
          err.message?.toLowerCase().includes("timeout")
        ) {
          isTransient = true;
        }
      }

      if (!isTransient) throw err;

      await new Promise((r) => setTimeout(r, delays[attempt]));
      attempt++;
    }
  }
}

export type ExportResult = "created" | "updated";

export async function exportTask(task: any, project: any): Promise<ExportResult> {
  return withRetry(async () => {
    const fields = {
      "Task ID": task.id,
      "Project ID": project.id,
      "Project Name": project.name,
      "Title": task.title,
      "Description": task.description || "",
      "Status": task.status,
      "Assignee": task.assignee?.name || "unassigned",
      "Position": String(task.position),
      "Created At": task.createdAt.toISOString(),
      "Updated At": task.updatedAt.toISOString(),
      "Task Updated At": new Date().toISOString(),
    };

    if (isTest) {
      const records = await mockAirtable.list();
      const existing = records.find((r) => r.fields["Task ID"] === task.id);
      if (existing) {
        await mockAirtable.update(existing.id, fields);
        return "updated";
      } else {
        await mockAirtable.create({
          fields: { ...fields, "Task Created At": new Date().toISOString() },
        });
        return "created";
      }
    } else {
      const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
        process.env.AIRTABLE_BASE_ID!
      );
      const table = base(process.env.AIRTABLE_TABLE_NAME!);

      const records = await table
        .select({
          filterByFormula: `{Task ID} = '${task.id}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length > 0) {
        await table.update(records[0].id, fields);
        return "updated";
      } else {
        await table.create({
          ...fields,
          "Task Created At": new Date().toISOString(),
        });
        return "created";
      }
    }
  });
}
