import { describe, it, expect } from "vitest";
import { can } from "@/lib/permissions";

describe("permission state machine", () => {
  it("admin can edit and delete the project", () => {
    expect(can("admin", "project:edit")).toBe(true);
    expect(can("admin", "project:delete")).toBe(true);
  });

  it("member cannot edit or delete the project", () => {
    expect(can("member", "project:edit")).toBe(false);
    expect(can("member", "project:delete")).toBe(false);
  });

  it("viewer cannot edit or delete the project", () => {
    expect(can("viewer", "project:edit")).toBe(false);
    expect(can("viewer", "project:delete")).toBe(false);
  });

  it("admin and member can create/edit/delete tasks and post comments", () => {
    for (const role of ["admin", "member"] as const) {
      expect(can(role, "task:create")).toBe(true);
      expect(can(role, "task:edit")).toBe(true);
      expect(can(role, "task:delete")).toBe(true);
      expect(can(role, "comment:create")).toBe(true);
      expect(can(role, "export:run")).toBe(true);
    }
  });

  it("viewer cannot create/edit/delete tasks, post comments, or run exports", () => {
    expect(can("viewer", "task:create")).toBe(false);
    expect(can("viewer", "task:edit")).toBe(false);
    expect(can("viewer", "task:delete")).toBe(false);
    expect(can("viewer", "comment:create")).toBe(false);
    expect(can("viewer", "export:run")).toBe(false);
  });

  it("denies every action for a null/undefined role (non-member)", () => {
    expect(can(null, "task:create")).toBe(false);
    expect(can(undefined, "project:edit")).toBe(false);
  });
});
