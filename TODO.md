# Feature TODO

Tracks Part 2 (fix) + Part 3a/3b/3c (features), separate from `REVIEW.md` (the graded
bug list). See `/Users/shubhm/.claude/plans/transient-squishing-hummingbird.md` for full
implementation detail on each item.

## Known overlaps / sequencing notes

- **`src/app/api/tasks/[id]/route.ts` `PATCH`** is touched twice: once for the optional
  IDOR fix (membership+role check), once for Activity Feed (diffing old vs. new
  status/assignee to emit events). Land the IDOR fix as its own commit *before* starting
  3b, so activity-emission code is added on top of already-correct auth, not mixed into
  the same diff.
- **Don't reintroduce REVIEW.md issue #3** (password hash leak via `include` instead of
  `select`) in new code. Comments' `author` and Activity Feed's `actor` must be fetched
  with `select: { id, name, email }`, never `include: true`.
- Comment creation is one of the Activity Feed's four event sources, so 3a's `POST`
  comments route and 3b's event-emission logic land together in practice, even though
  they're listed as separate parts below.
- `REVIEW.md` itself needs no content changes from either of the above — both are
  implementation-order notes, not corrections to the bug descriptions.

## Part 2 — Fix (required)

- [x] Rewrite `src/app/api/projects/[id]/tasks/route.ts` search branch: drop
      `$queryRawUnsafe`, use Prisma's query builder
- [x] Add `searchQuerySchema` zod validator for `q`
- [x] Unit test: no raw SQL invoked, malicious `q` treated as literal
      (`src/tests/tasks-search.test.ts`, 5 tests, TDD red→green — see git log)
- [ ] Curl before/after proof — commands ready in `CURL_PROOFS.md`, needs to be run
      live in a `script -a TERMINAL_LOG.txt` session (not yet captured)
- [ ] *(Separate commit)* Fix IDOR in `tasks/[id]/route.ts` `PATCH` — same
      `getProjectMembership`/`canEditTasks` check `DELETE` already has

## Part 3a — Task Comments

- [x] Prisma `Comment` model (`taskId`, `authorId`, `body`, `createdAt`) + migration
      (`20260729073632_add_comments`)
- [x] `src/schemas/comment.ts` — `createCommentSchema`
- [x] `GET/POST /api/tasks/[id]/comments` — membership check both; `POST` requires
      admin/member (viewers 403); no `PATCH`/`DELETE` route (append-only by omission)
- [x] Frontend: comments section in `TaskDetail.tsx` — chronological list + post form
      gated on role (`myRole` computed in `ProjectPage` from `project.memberships`)
- [x] Tests: viewer-post-403, member-post-201, non-member-get-403 (via 404 task-not-found
      path is separate; non-member-on-real-task returns 403), ordering
      (`src/tests/comments.test.ts`, 7 tests, TDD red→green)
- [x] Verified live in browser (Playwright): member posts → appears without reload,
      input clears; viewer sees the comment but gets "viewers cannot post comments"
      instead of the form. Confirmed Docker's `web` container needed its own
      `prisma generate` re-run since its `node_modules` is a separate named volume
      from the host's.

## Auth architecture (ad hoc, user-requested mid-session)

Not part of REVIEW.md or the original Part 2/3a/3b/3c plan — user asked directly for
these two after Part 3a was done.

- [x] `src/middleware.ts` — Next.js middleware (Node.js runtime, since `jsonwebtoken`
      needs Node's `crypto`, not Edge's Web Crypto) verifies the JWT for every
      `/api/*` route except `/api/auth/login` and `/api/auth/register`, returning 401
      before the request reaches any handler. Forwards the decoded `userId`/`email` via
      `x-user-id`/`x-user-email` request headers (not currently consumed downstream —
      each route's own `getCurrentUser` still does its own lookup; this is authentication
      only, scoped per user's explicit choice, not full request-auth centralization).
- [x] `src/lib/permissions.ts` — `can(role, action)` state machine (roles = states,
      actions = guarded transitions) replacing the old `canEditProject`/`canEditTasks`
      ad hoc booleans in `src/lib/auth.ts`. Actions: `project:edit`, `project:delete`,
      `task:create`, `task:edit`, `task:delete`, `comment:create`, `export:run` (latter
      pre-declared for Part 3c, not wired up yet since export routes don't exist).
      Wired into all 4 former call sites (`projects/[id]/route.ts` PATCH+DELETE,
      `tasks/[id]/route.ts` DELETE, `projects/[id]/tasks/route.ts` POST,
      `tasks/[id]/comments/route.ts` POST).
- [x] Tests: `src/tests/middleware.test.ts` (5 tests), `src/tests/permissions.test.ts`
      (6 tests), both TDD red→green. Verified live via curl: viewer 403 on
      project-edit/task-delete/task-create/comment-create, member 201 on task-create.
- Note: `tasks/[id]/route.ts` `PATCH` still has no membership/role check at all (bug #2,
  IDOR) — intentionally left alone here since it's tracked as its own separate fix
  above, not folded into this refactor.

## Part 3b — Activity Feed

- [ ] Prisma `ActivityEvent` model (`projectId`, `actorId`, `action`, `metadata`,
      `createdAt`) + migration (combined with Comment migration)
- [ ] Emit events from: task creation, task status/assignee change (`PATCH
      /api/tasks/[id]`), comment creation
- [ ] Rollback decision: wrap primary mutation + activity insert in
      `prisma.$transaction` — write rationale into `DESIGN_NOTES.md`
- [ ] `GET /api/projects/[id]/activity` — any member role can read, most-recent-first
- [ ] Frontend: activity section on project detail page, invalidated on every relevant
      mutation
- [ ] Tests: transaction invoked on task creation/status change, non-member read 403

## Part 3c — Airtable Export (mandatory)

- [ ] `src/lib/airtable.ts` — real client via official `airtable` npm package, same
      interface shape as `airtable-mock.ts`
- [ ] Idempotency: store `task.id` in a `Task ID` field, map existing records,
      update-vs-create per run
- [ ] Error handling: transient (429/5xx/network → retry w/ backoff) vs. permanent
      (other 4xx → no retry); per-record isolation so one bad record doesn't fail the
      batch
- [ ] `POST /api/projects/[id]/export` — admin/member only (viewers 403), returns
      `{exported, updated, failed}` summary
- [ ] Frontend: "Export to Airtable" trigger + result summary on project detail page
- [ ] Tests using `AirtableMockClient`: idempotency (run twice, same count),
      transient-retry-succeeds, permanent-failure-doesn't-sink-batch
- [ ] Real demo: run against actual Airtable base twice, screenshot/share-link showing
      records + no duplicates on 2nd run

## Bonus — Kanban Drag & Drop

Flagging again: this isn't part of Part 1/2/3a/3b/3c and doesn't map to any REVIEW.md
category — only take this on if the required parts are done and tested with time to
spare.

- [ ] `src/hooks/useDragAndDrop.ts` — reusable hook wrapping native HTML5 DnD
      (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`; no new
      dependency needed, keeps the app's zero-UI-library approach). Exposes something
      like `{ draggingId, dragHandlers(taskId), dropHandlers(status, index) }` so
      `StatusColumn`/`TaskCard` stay presentational and the hook is reusable if another
      sortable list ever shows up.
- [ ] `TaskCard.tsx` — apply `dragHandlers`; `StatusColumn.tsx` — apply `dropHandlers`
      per column
- [ ] Backend correctness decision: moving a task changes both its `status` and its
      `position`, and neighbors in the affected column(s) need their `position`s shifted
      too or ordering breaks (ties on `orderBy position asc`). Two options:
      (a) client recomputes the affected column's full ordered task-id list on drop and
      fires one `PATCH /api/tasks/[id]` per task (simplest, more round-trips), or
      (b) add `PATCH /api/projects/[id]/tasks/reorder` accepting
      `{ status, taskIdsInOrder }` and updating all positions in a single
      `prisma.$transaction` (cleaner, one round-trip, more work). Pick (a) if time is
      short, (b) if there's room.
- [ ] Optimistic UI update via React Query (`onMutate`/manual cache update) so the drag
      feels instant, rather than waiting for `invalidateQueries` to refetch
- [ ] Tests: hook-level unit test for position recalculation — same-column reorder and
      cross-column move

## Final assembly

- [ ] Full `npm test` run
- [ ] `TERMINAL_LOG.md` in required order: setup → initial test run → bug curl proof →
      fix curl proof → 3c export demo ×2 → 3a/3b demo → final test run
