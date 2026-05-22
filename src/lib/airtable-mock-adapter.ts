import type { AirtableMockClient } from "@/lib/airtable-mock";
import type { AirtableRecordWriter, AirtableUpsertInput } from "@/lib/airtable-client";

export function createMockAirtableWriter(client: AirtableMockClient): AirtableRecordWriter {
  return {
    async upsertBatch(records: AirtableUpsertInput[]): Promise<void> {
      for (const record of records) {
        const taskBoardId = record.fields["TaskBoard ID"];
        const id = typeof taskBoardId === "string" ? taskBoardId : undefined;
        await client.create({ id, fields: record.fields });
      }
    },
  };
}
