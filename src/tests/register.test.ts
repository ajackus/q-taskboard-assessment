import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/auth/register/route";

const MOCK_USER = { id: "u1", email: "new@test.com", name: "New User" };

function registerRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register — Issue #3 email uniqueness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
  });

  it("registers a new user and returns 201 with a token", async () => {
    const res = await POST(
      registerRequest({ email: "new@test.com", password: "strongpassword", name: "New User" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("new@test.com");
    expect(typeof body.token).toBe("string");
  });

  it("returns 400 for invalid input (short password)", async () => {
    const res = await POST(
      registerRequest({ email: "new@test.com", password: "short", name: "New User" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid input (malformed email)", async () => {
    const res = await POST(
      registerRequest({ email: "not-an-email", password: "strongpassword", name: "New User" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 with a clear message when DB raises a P2002 unique-email violation", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`email`)",
      { code: "P2002", clientVersion: "6.1.0", meta: { target: ["email"] } }
    );
    (prisma.user.create as ReturnType<typeof vi.fn>).mockRejectedValue(p2002);

    const res = await POST(
      registerRequest({ email: "taken@test.com", password: "strongpassword", name: "Dupe User" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("re-throws non-P2002 database errors (does not swallow them)", async () => {
    const internalError = new Error("connection refused");
    (prisma.user.create as ReturnType<typeof vi.fn>).mockRejectedValue(internalError);

    await expect(
      POST(registerRequest({ email: "x@test.com", password: "strongpassword", name: "User" }))
    ).rejects.toThrow("connection refused");
  });
});
