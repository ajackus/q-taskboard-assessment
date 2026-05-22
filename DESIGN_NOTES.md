# Design notes

## Activity feed: rollback strategy

Each activity row is written inside the same Prisma `$transaction` as the
underlying change (task create, status/assignee update, comment post). If the
activity insert fails, the entire transaction rolls back and the original
change is undone as well.

The reasoning: the activity feed is the audit trail for who did what and when.
A change that exists in the database without an activity row would be invisible
to project members, which is worse than the change failing outright — the user
gets a clear error and can retry, and we never end up with silent untracked
edits. The activity table is small and writes to it almost never fail, so the
cost of coupling them is negligible compared to the cost of an inconsistent
audit log.
