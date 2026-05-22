import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      API_KEY: process.env.AIRTABLE_API_KEY ? "set" : "missing",
      BASE_ID: process.env.AIRTABLE_BASE_ID ? "set" : "missing",
      TABLE_NAME: process.env.AIRTABLE_TABLE_NAME || "Tasks",
    },
    tests: {},
  };

  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!API_KEY || !BASE_ID) {
    return NextResponse.json({
      ...diagnostics,
      error: "Airtable credentials not configured",
    });
  }

  try {
    // Test 1: DNS resolution
    console.log("[Diagnostics] Testing DNS resolution for api.airtable.com...");
    const dns = require("dns").promises;
    try {
      const addresses = await dns.resolve4("api.airtable.com");
      diagnostics.tests.dns = {
        status: "ok",
        addresses,
      };
      console.log("[Diagnostics] DNS resolved:", addresses);
    } catch (err: any) {
      diagnostics.tests.dns = {
        status: "failed",
        error: err.message,
      };
      console.error("[Diagnostics] DNS failed:", err);
    }

    // Test 2: Simple fetch to Airtable API
    console.log("[Diagnostics] Testing fetch to Airtable API...");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${process.env.AIRTABLE_TABLE_NAME || "Tasks"}?maxRecords=1`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      diagnostics.tests.api_call = {
        status: "ok",
        statusCode: response.status,
        statusText: response.statusText,
      };

      if (response.ok) {
        const data = await response.json();
        diagnostics.tests.api_call.recordCount = data.records?.length || 0;
      } else {
        const text = await response.text();
        diagnostics.tests.api_call.error = text;
      }

      console.log("[Diagnostics] API call succeeded:", response.status);
    } catch (err: any) {
      diagnostics.tests.api_call = {
        status: "failed",
        error: err.message,
        code: err.code,
        causeCode: err.cause?.code,
      };
      console.error("[Diagnostics] API call failed:", err);
    }

    // Test 3: Network info
    console.log("[Diagnostics] Gathering network info...");
    try {
      const os = require("os");
      const interfaces = os.networkInterfaces();
      diagnostics.tests.network = {
        status: "ok",
        interfaces: Object.keys(interfaces).length,
        details: {},
      };

      for (const [name, addrs] of Object.entries(interfaces)) {
        if (addrs) {
          diagnostics.tests.network.details[name] = (addrs as any).map(
            (addr: any) => `${addr.family}:${addr.address}`
          );
        }
      }
    } catch (err: any) {
      diagnostics.tests.network = {
        status: "failed",
        error: err.message,
      };
    }

    return NextResponse.json(diagnostics);
  } catch (err: any) {
    diagnostics.error = err.message;
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
