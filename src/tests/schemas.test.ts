import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/schemas/auth";
import { createMembershipSchema, updateMembershipSchema } from "@/schemas/membership";
import { createTaskSchema, updateTaskSchema } from "@/schemas/task";

describe("auth schemas", () => {
  it("accepts a well-formed register payload", () => {
    const result = registerSchema.safeParse({
      email: "x@y.com",
      password: "longenoughpassword",
      name: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = registerSchema.safeParse({
      email: "x@y.com",
      password: "short",
      name: "Test User",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email on login", () => {
    const result = loginSchema.safeParse({ password: "anything" });
    expect(result.success).toBe(false);
  });
});

describe("task schemas", () => {
  it("accepts a minimal create task payload", () => {
    const result = createTaskSchema.safeParse({ title: "do the thing" });
    expect(result.success).toBe(true);
  });

  it("rejects empty titles", () => {
    const result = createTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a status update", () => {
    const result = updateTaskSchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown statuses", () => {
    const result = updateTaskSchema.safeParse({ status: "blocked" });
    expect(result.success).toBe(false);
  });
});

describe("membership schemas", () => {
  it("accepts member and viewer roles on create", () => {
    expect(
      createMembershipSchema.safeParse({ userId: "u_1", role: "member" }).success
    ).toBe(true);
    expect(
      createMembershipSchema.safeParse({ userId: "u_1", role: "viewer" }).success
    ).toBe(true);
  });

  it("rejects admin role on create", () => {
    const result = createMembershipSchema.safeParse({
      userId: "u_1",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("accepts member and viewer on update", () => {
    expect(updateMembershipSchema.safeParse({ role: "viewer" }).success).toBe(true);
  });

  it("rejects admin role on update", () => {
    const result = updateMembershipSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(false);
  });
});
