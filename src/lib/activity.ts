import { Prisma, type PrismaClient, type ActivityType } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Record an activity row inside an existing transaction.
 *
 * The activity write happens in the same DB transaction as the underlying
 * change (task create, status change, comment, etc). If the activity insert
 * fails the whole transaction is rolled back so we never have a change
 * without its audit row.
 *
 * See DESIGN_NOTES.md for the rollback rationale.
 */
export async function recordActivity(
  tx: TxClient,
  input: {
    projectId: string;
    actorId: string;
    type: ActivityType;
    taskId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.activity.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      type: input.type,
      taskId: input.taskId ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}
