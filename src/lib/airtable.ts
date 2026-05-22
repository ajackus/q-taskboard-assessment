import https from "https";
import { lookup } from "dns";

// Force IPv4 resolution to avoid IPv6 connect timeouts on certain networks.
// Node.js's default dual-stack lookup can hang when IPv6 routing is broken
// while IPv4 works fine (which is why curl succeeds but fetch/https fails).
const ipv4Lookup = (hostname: string, options: any, callback: any) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return lookup(hostname, { ...options, family: 4 }, callback);
};

const httpsAgent = new https.Agent({
  keepAlive: true,
  lookup: ipv4Lookup as any,
});

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Tasks";

if (!API_KEY || !BASE_ID) {
  console.warn(
    "Airtable credentials not configured. Export features will be disabled."
  );
}

export type AirtableTaskFields = {
  TaskId: string;
  Name: string;
  Description?: string;
  Status: string;
  AssigneeId?: string;
  CreatedById: string;
  Position: number;
  CreatedAt: string;
  UpdatedAt: string;
};

export type AirtableRecord = {
  id: string;
  fields: Partial<AirtableTaskFields>;
  createdTime: string;
};

export type AirtableError = {
  status: number;
  error: {
    type: string;
    message: string;
  };
};

export class AirtableClient {
  private readonly MAX_RETRIES = 1;
  private readonly RETRY_DELAY_MS = 3000;
  private readonly TIMEOUT = 60000;

  constructor() {
    console.log("[Airtable] Initializing client...");
    console.log("[Airtable] API_KEY configured:", !!API_KEY);
    console.log("[Airtable] BASE_ID configured:", !!BASE_ID);
    console.log("[Airtable] TABLE_NAME:", TABLE_NAME);
  }

  isConfigured(): boolean {
    return !!API_KEY && !!BASE_ID;
  }

  async createOrUpdateTask(
    taskId: string,
    fields: AirtableTaskFields
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[Airtable] Creating/updating task: ${taskId}`);
    console.log(`[Airtable] Fields:`, JSON.stringify(fields, null, 2));

    if (!this.isConfigured()) {
      console.error("[Airtable] Not configured");
      return { success: false, error: "Airtable not configured" };
    }

    try {
      console.log(`[Airtable] Searching for existing record with TaskId: ${taskId}...`);

      let existingRecord: any = null;
      const filter = `{TaskId} = '${taskId}'`;
      console.log(`[Airtable] Filter formula:`, filter);
      const encodedFilter = encodeURIComponent(filter);
      const path = `/v0/${BASE_ID}/${TABLE_NAME}?filterByFormula=${encodedFilter}&maxRecords=1`;

      await this.retryableRequest(async () => {
        const data = await this.httpsRequest("GET", path, null);
        const records = data.records || [];
        console.log(`[Airtable] Search succeeded, found ${records.length} records`);
        if (records.length > 0) {
          existingRecord = records[0];
          console.log(`[Airtable] Found existing record:`, existingRecord.id);
        }
      });

      // Create or update
      await this.retryableRequest(async () => {
        if (existingRecord) {
          console.log(`[Airtable] Updating existing record ${existingRecord.id}...`);
          const updatePath = `/v0/${BASE_ID}/${TABLE_NAME}/${existingRecord.id}`;
          await this.httpsRequest("PATCH", updatePath, { fields, typecast: true });
          console.log(`[Airtable] Update successful`);
        } else {
          console.log(`[Airtable] Creating new record...`);
          const createPath = `/v0/${BASE_ID}/${TABLE_NAME}`;
          await this.httpsRequest("POST", createPath, { fields, typecast: true });
          console.log(`[Airtable] Create successful`);
        }
      });

      console.log(`[Airtable] Task ${taskId} created/updated successfully`);
      return { success: true };
    } catch (err) {
      const errorMsg = this.formatError(err);
      const isTransient = this.isTransientError(err);

      console.error(`[Airtable] Error for task ${taskId}:`, {
        errorMsg,
        isTransient,
      });

      if (!isTransient) {
        console.error(`[Airtable] Permanent error for task ${taskId}:`, errorMsg);
        return { success: false, error: errorMsg };
      }

      console.error(`[Airtable] Transient error for task ${taskId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async fetchAllRecords(projectId: string): Promise<AirtableRecord[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const records: AirtableRecord[] = [];
      const filter = `{Project ID} = '${projectId}'`;
      const encodedFilter = encodeURIComponent(filter);
      const path = `/v0/${BASE_ID}/${TABLE_NAME}?filterByFormula=${encodedFilter}`;

      await this.retryableRequest(async () => {
        const data = await this.httpsRequest("GET", path, null);
        const pageRecords = data.records || [];
        records.push(
          ...pageRecords.map((record: any) => ({
            id: record.id,
            fields: record.fields,
            createdTime: record.createdTime,
          }))
        );
      });

      return records;
    } catch (err) {
      console.error("[Airtable] Error fetching records:", this.formatError(err));
      return [];
    }
  }

  async deleteRecord(recordId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      await this.retryableRequest(async () => {
        const path = `/v0/${BASE_ID}/${TABLE_NAME}/${recordId}`;
        await this.httpsRequest("DELETE", path, null);
      });
      return true;
    } catch (err) {
      console.error(
        `[Airtable] Error deleting record ${recordId}:`,
        this.formatError(err)
      );
      return false;
    }
  }

  private async httpsRequest(
    method: string,
    path: string,
    body: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`[Airtable] ${method} ${path}`);

      const options = {
        hostname: "api.airtable.com",
        port: 443,
        path,
        method,
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "User-Agent": "Taskboard/1.0",
        },
        timeout: this.TIMEOUT,
        agent: httpsAgent,
        family: 4,
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(`[Airtable] Response status: ${res.statusCode}`);

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(
                `Airtable API error ${res.statusCode}: ${data}`
              )
            );
          }

          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            resolve({});
          }
        });
      });

      req.on("error", (err) => {
        console.error(`[Airtable] Request error:`, err);
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      if (body) {
        const bodyStr = JSON.stringify(body);
        req.write(bodyStr);
      }

      req.end();
    });
  }

  private async retryableRequest<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        console.log(`[Airtable] Attempt ${attempt + 1}/${this.MAX_RETRIES}...`);
        const result = await fn();
        console.log(`[Airtable] Attempt ${attempt + 1} succeeded`);
        return result;
      } catch (err) {
        lastError = err;
        const isTransient = this.isTransientError(err);

        console.error(`[Airtable] Attempt ${attempt + 1} failed:`, {
          isTransient,
          message: (err as any)?.message,
        });

        if (!isTransient) {
          console.error(`[Airtable] Permanent error (not retrying), throwing...`);
          throw err;
        }

        if (attempt < this.MAX_RETRIES - 1) {
          const delayMs = this.RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[Airtable] Transient error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`
          );
          await this.sleep(delayMs);
        }
      }
    }

    console.error(
      `[Airtable] All ${this.MAX_RETRIES} attempts failed, throwing last error`
    );
    throw lastError;
  }

  private isTransientError(err: any): boolean {
    const message = (err?.message || "").toLowerCase();
    const code = err?.code || err?.errno;

    console.log(`[Airtable] Checking if error is transient:`, {
      code,
      message: err?.message,
    });

    // Network errors
    if (
      code === "ETIMEDOUT" ||
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "ECONNRESET" ||
      code === "EHOSTUNREACH"
    ) {
      console.log(`[Airtable] Network error (${code}) - transient`);
      return true;
    }

    if (message.includes("timeout")) {
      console.log(`[Airtable] Timeout error - transient`);
      return true;
    }

    if (message.includes("econnrefused") || message.includes("connect")) {
      console.log(`[Airtable] Connection error - transient`);
      return true;
    }

    // HTTP status from error message
    if (message.includes("429")) {
      console.log(`[Airtable] Rate limit (429) - transient`);
      return true;
    }

    if (message.match(/\b5\d{2}\b/)) {
      console.log(`[Airtable] Server error (5xx) - transient`);
      return true;
    }

    console.log(`[Airtable] Error - permanent`);
    return false;
  }

  private formatError(err: any): string {
    if (err?.message) {
      return err.message;
    }
    return String(err);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const airtable = new AirtableClient();
