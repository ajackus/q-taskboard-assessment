import Airtable from "airtable";

export type AirtableCollaborator = { email: string };
export type AirtableFieldValue =
  | string
  | number
  | null
  | AirtableCollaborator
  | AirtableCollaborator[];
export type AirtableUpsertInput = { fields: Record<string, AirtableFieldValue> };

export interface AirtableRecordWriter {
  upsertBatch(records: AirtableUpsertInput[]): Promise<void>;
}

export type AirtableConfig = {
  apiKey: string;
  baseId: string;
  tableName: string;
};

export function getAirtableConfig(): AirtableConfig {
  const apiKey = process.env.AIRTABLE_API_KEY?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const tableName = process.env.AIRTABLE_TABLE_NAME?.trim() || "Tasks";

  if (!apiKey || !baseId) {
    throw new Error(
      "Airtable is not configured. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in your environment."
    );
  }

  return { apiKey, baseId, tableName };
}

export function getAirtableBaseUrl(baseId: string): string {
  return `https://airtable.com/${baseId}`;
}

export function createAirtableWriter(config?: AirtableConfig): AirtableRecordWriter {
  const { apiKey, baseId, tableName } = config ?? getAirtableConfig();
  const base = new Airtable({ apiKey }).base(baseId);
  const table = base(tableName);

  return {
    async upsertBatch(records: AirtableUpsertInput[]): Promise<void> {
      if (records.length === 0) return;
      // performUpsert is supported by the API; SDK types predate the upsert option
      const upsertRecords = records.map((r) => ({ fields: r.fields }));
      const upsertOptions = {
        performUpsert: { fieldsToMergeOn: ["TaskBoard ID"] },
        typecast: true,
      };
      type UpsertTable = {
        update: (
          data: { fields: Record<string, AirtableFieldValue> }[],
          opts?: typeof upsertOptions
        ) => Promise<unknown>;
      };
      await (table as unknown as UpsertTable).update(upsertRecords, upsertOptions);
    },
  };
}
