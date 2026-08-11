import Airtable from "airtable";
import {
  AirtableError,
  type AirtableCreateInput,
  type AirtableFields,
  type AirtableRecord,
} from "./airtable-mock";

/**
 * Real Airtable client. Implements the same list/create/update contract the
 * mock does, so the sync logic in airtable-sync.ts is unchanged. Transient
 * failures (429 / 5xx / network) are re-thrown as AirtableError so the retry
 * loop picks them up; config errors (e.g. 422 unknown field) throw as-is and
 * are NOT retried.
 */

let table: Airtable.Table<Airtable.FieldSet> | null = null;

function getTable(): Airtable.Table<Airtable.FieldSet> {
  if (table) return table;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || "Tasks";
  if (!apiKey || !baseId) {
    throw new Error(
      "Airtable not configured: set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env",
    );
  }
  table = new Airtable({ apiKey }).base(baseId)(tableName);
  return table;
}

function toAirtableError(err: unknown): never {
  const status =
    typeof err === "object" && err !== null && "statusCode" in err
      ? Number((err as { statusCode: unknown }).statusCode)
      : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (status === 429) throw new AirtableError(message, "rate-limit", 429);
  if (status && status >= 500) throw new AirtableError(message, "server-error", status);
  if (status === undefined) throw new AirtableError(message, "network", 0);
  throw err; // 4xx config/validation errors — not retryable
}

export const airtable = {
  async list(): Promise<AirtableRecord[]> {
    try {
      const records = await getTable().select().all();
      return records.map((r) => ({
        id: r.id,
        fields: r.fields,
        createdTime: (r as unknown as { _rawJson: { createdTime: string } })
          ._rawJson.createdTime,
      }));
    } catch (err) {
      toAirtableError(err);
    }
  },

  async create(input: AirtableCreateInput): Promise<AirtableRecord> {
    try {
      const r = await getTable().create(input.fields as Airtable.FieldSet);
      return {
        id: r.id,
        fields: r.fields,
        createdTime: (r as unknown as { _rawJson: { createdTime: string } })
          ._rawJson.createdTime,
      };
    } catch (err) {
      toAirtableError(err);
    }
  },

  async update(id: string, fields: AirtableFields): Promise<AirtableRecord> {
    try {
      const r = await getTable().update(id, fields as Airtable.FieldSet);
      return {
        id: r.id,
        fields: r.fields,
        createdTime: (r as unknown as { _rawJson: { createdTime: string } })
          ._rawJson.createdTime,
      };
    } catch (err) {
      toAirtableError(err);
    }
  },
};
