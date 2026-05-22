import { z } from "zod";

const assignableRole = z.enum(["member", "viewer"]);

export const createMembershipSchema = z.object({
  userId: z.string().min(1),
  role: assignableRole,
});

export const updateMembershipSchema = z.object({
  role: assignableRole,
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
