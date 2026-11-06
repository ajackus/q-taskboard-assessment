import AirtableSDK from "airtable";
import {
  AirtableError,
  type AirtableCreateInput,
  type AirtableFields,
  type AirtableRecord,
} from "@/lib/airtable-mock";

/**
 * Shared shape both the mock and the real client implement, so
 * `exportTasksToAirtable` (src/lib/airtable-export.ts) is client-agnostic:
 * tests inject `AirtableMockClient`, production wires up `RealAirtableClient`.
 */
export interface AirtableClient {
  create(input: AirtableCreateInput): Promise<AirtableRecord>;
  update(id: string, fields: AirtableFields): Promise<AirtableRecord>;
  list(): Promise<AirtableRecord[]>;
}

export class RealAirtableClient implements AirtableClient {
  // AirtableFields (Record<string, unknown>) is looser than the SDK's FieldSet
  // constraint, so we hold the table as FieldSet and cast at the two
  // create/update call boundaries below — the runtime values are always
  // plain strings (see taskFields() in airtable-export.ts).
  private table: AirtableSDK.Table<AirtableSDK.FieldSet>;

  constructor(apiKey: string, baseId: string, tableName: string) {
    const base = new AirtableSDK({ apiKey }).base(baseId);
    this.table = base(tableName) as AirtableSDK.Table<AirtableSDK.FieldSet>;
  }

  async create(input: AirtableCreateInput): Promise<AirtableRecord> {
    try {
      const [record] = await this.table.create(
        [{ fields: input.fields as AirtableSDK.FieldSet }],
        { typecast: true }
      );
      return toAirtableRecord(record);
    } catch (err) {
      throw toAirtableError(err);
    }
  }

  async update(id: string, fields: AirtableFields): Promise<AirtableRecord> {
    try {
      const [record] = await this.table.update(
        [{ id, fields: fields as AirtableSDK.FieldSet }],
        { typecast: true }
      );
      return toAirtableRecord(record);
    } catch (err) {
      throw toAirtableError(err);
    }
  }

  async list(): Promise<AirtableRecord[]> {
    try {
      const records = await this.table.select().all();
      return records.map(toAirtableRecord);
    } catch (err) {
      throw toAirtableError(err);
    }
  }
}

function toAirtableRecord(record: AirtableSDK.Record<AirtableSDK.FieldSet>): AirtableRecord {
  const rawCreatedTime = (record._rawJson as { createdTime?: string } | undefined)
    ?.createdTime;
  return {
    id: record.id,
    fields: record.fields,
    createdTime: rawCreatedTime ?? new Date().toISOString(),
  };
}

/**
 * Normalizes whatever the airtable SDK throws into our shared AirtableError
 * shape. `AirtableErrorType` only has 3 values (no generic "client error"), so
 * a permanent 4xx (400/404/422/...) is labeled "server-error" here too — that
 * label is cosmetic; `statusCode` is what the retry logic in
 * src/lib/airtable-export.ts actually branches on.
 */
function toAirtableError(err: unknown): AirtableError {
  const statusCode = (err as { statusCode?: number } | null)?.statusCode;
  const message = err instanceof Error ? err.message : "unknown Airtable error";

  if (statusCode === 429) return new AirtableError(message, "rate-limit", 429);
  if (typeof statusCode === "number" && statusCode >= 500) {
    return new AirtableError(message, "server-error", statusCode);
  }
  if (typeof statusCode !== "number") return new AirtableError(message, "network", 0);
  return new AirtableError(message, "server-error", statusCode);
}

export function getAirtableClient(): AirtableClient {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME;
  if (!apiKey || !baseId || !tableName) {
    throw new Error(
      "AIRTABLE_API_KEY, AIRTABLE_BASE_ID, and AIRTABLE_TABLE_NAME must all be set"
    );
  }
  return new RealAirtableClient(apiKey, baseId, tableName);
}
