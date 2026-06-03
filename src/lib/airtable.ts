import Airtable from "airtable";
import { AirtableMockClient, type AirtableFields } from "./airtable-mock";

// ── Shared types ──────────────────────────────────────────────────────────────

export type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

/** Uniform interface used by the export route — satisfied by both adapters. */
export interface AirtableTableClient {
  fetchAll(): Promise<AirtableRecord[]>;
  batchCreate(records: Array<{ fields: Record<string, unknown> }>): Promise<void>;
  batchUpdate(
    records: Array<{ id: string; fields: Record<string, unknown> }>
  ): Promise<void>;
}

// ── Utility exported so the route can import it (and tests can mock it) ───────

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── Field-name map — every key maps to an Airtable column name ────────────────

/**
 * Maps logical field names to the actual column names in the Airtable base.
 * Override any value via the corresponding AIRTABLE_FIELD_* env var so no
 * code change is needed when the Airtable table uses different column names.
 *
 * Example .env:
 *   AIRTABLE_FIELD_TASK_ID=LocalID
 *   AIRTABLE_FIELD_TITLE=Name
 */
export type AirtableFieldMap = {
  taskId: string;      // unique lookup key — maps our task.id to an Airtable column
  title: string;
  description: string;
  status: string;
  assignee: string;
  createdBy: string;
  position: string;
};

export function getFieldMap(): AirtableFieldMap {
  return {
    taskId:      process.env.AIRTABLE_FIELD_TASK_ID      ?? "TaskID",
    title:       process.env.AIRTABLE_FIELD_TITLE        ?? "Title",
    description: process.env.AIRTABLE_FIELD_DESCRIPTION  ?? "Description",
    status:      process.env.AIRTABLE_FIELD_STATUS       ?? "Status",
    assignee:    process.env.AIRTABLE_FIELD_ASSIGNEE     ?? "Assignee",
    createdBy:   process.env.AIRTABLE_FIELD_CREATED_BY   ?? "CreatedBy",
    position:    process.env.AIRTABLE_FIELD_POSITION     ?? "Position",
  };
}

// ── Mock adapter: wraps AirtableMockClient for test environments ──────────────

export class MockAirtableTableClient implements AirtableTableClient {
  private readonly taskIdField: string;

  /**
   * @param mock      The AirtableMockClient instance to delegate to.
   * @param fieldMap  Optional field map — defaults to getFieldMap() so env-var
   *                  overrides apply to integration tests automatically.
   */
  constructor(
    private readonly mock: AirtableMockClient,
    fieldMap?: AirtableFieldMap
  ) {
    this.taskIdField = (fieldMap ?? getFieldMap()).taskId;
  }

  async fetchAll(): Promise<AirtableRecord[]> {
    return this.mock.list();
  }

  async batchCreate(
    records: Array<{ fields: Record<string, unknown> }>
  ): Promise<void> {
    for (const r of records) {
      // Pin the mock record id to the configured taskId field so that
      // fetchAll + lookup work correctly across upsert cycles.
      const taskId = r.fields[this.taskIdField] as string | undefined;
      await this.mock.create({ id: taskId, fields: r.fields as AirtableFields });
    }
  }

  async batchUpdate(
    records: Array<{ id: string; fields: Record<string, unknown> }>
  ): Promise<void> {
    for (const r of records) {
      await this.mock.update(r.id, r.fields as AirtableFields);
    }
  }
}

// ── Real client: wraps the official airtable npm package ─────────────────────

class RealAirtableTableClient implements AirtableTableClient {
  private readonly table: Airtable.Table<Airtable.FieldSet>;

  constructor() {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID ?? ""
    );
    this.table = base(process.env.AIRTABLE_TABLE_NAME ?? "Tasks");
  }

  async fetchAll(): Promise<AirtableRecord[]> {
    const records = await this.table.select().all();
    return records.map((r) => ({ id: r.id, fields: r.fields }));
  }

  async batchCreate(
    records: Array<{ fields: Record<string, unknown> }>
  ): Promise<void> {
    // Airtable expects a mutable array; cast away readonly.
    await this.table.create(
      records.map((r) => ({ fields: r.fields as Airtable.FieldSet }))
    );
  }

  async batchUpdate(
    records: Array<{ id: string; fields: Record<string, unknown> }>
  ): Promise<void> {
    await this.table.update(
      records.map((r) => ({ id: r.id, fields: r.fields as Airtable.FieldSet }))
    );
  }
}

// ── Factory (production path; tests mock this entire module) ──────────────────

export function getAirtableTableClient(): AirtableTableClient {
  return new RealAirtableTableClient();
}
