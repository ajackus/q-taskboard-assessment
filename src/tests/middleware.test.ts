import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signToken } from "@/lib/jwt";

function makeRequest(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(url, { headers });
}

describe("auth middleware", () => {
  it("rejects a protected api route with no token", () => {
    const res = middleware(makeRequest("http://localhost/api/projects"));
    expect(res.status).toBe(401);
  });

  it("rejects a protected api route with a garbage token", () => {
    const res = middleware(makeRequest("http://localhost/api/projects", "not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("lets a valid token through and forwards the decoded user id/email", () => {
    const token = signToken({ userId: "u1", email: "a@b.com" });
    const res = middleware(makeRequest("http://localhost/api/projects", token));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBe("u1");
    expect(res.headers.get("x-middleware-request-x-user-email")).toBe("a@b.com");
  });

  it("allows login without a token", () => {
    const res = middleware(makeRequest("http://localhost/api/auth/login"));
    expect(res.status).toBe(200);
  });

  it("allows register without a token", () => {
    const res = middleware(makeRequest("http://localhost/api/auth/register"));
    expect(res.status).toBe(200);
  });
});
