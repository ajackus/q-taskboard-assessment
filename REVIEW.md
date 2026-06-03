# Security & Architecture Review — TaskBoard API

**Reviewer:** Senior Security Architect  
**Date:** 2026-06-03  
**Test baseline:** `npm test` — 12/12 passing, 3 test files green  

---

## Issue #1 — IDOR / BOLA: `PATCH /api/tasks/[id]` skips authorization entirely

| Field | Value |
|---|---|
| **File** | `src/app/api/tasks/[id]/route.ts` lines 16–38 |
| **Category** | Security — Broken Object-Level Authorization (OWASP API3) |
| **Severity** | **Critical** |

### Description

The `PATCH` handler authenticates the caller (`getCurrentUser`) but never calls `getProjectMembership`, so any authenticated user can modify **any task in the system** by knowing its ID — regardless of whether they belong to the owning project. The `DELETE` handler in the same file (lines 40–57) correctly enforces membership, making the omission on `PATCH` a clear oversight rather than intentional design.

### Recommended Fix

After resolving the task from the database, add the same membership guard used by `DELETE`:

```ts
const membership = await getProjectMembership(user.id, existing.projectId);
if (!membership) return forbidden("you are not a member of this project");
if (!canEditTasks(membership.role)) return forbidden("viewers cannot edit tasks");
```

---

### Proof-of-Concept

**Scenario:** Attacker (User B) has a valid JWT but is **not** a member of the project that owns task `task_abc123`. Victim (User A) owns that task inside Project `proj_xyz789`.

**Step 1 — Attacker logs in and obtains a token (legitimate):**
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"password123"}' | jq .token
# → "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Step 2 — Attacker PATCHes a task they have no business touching:**
```bash
curl -s -X PATCH http://localhost:3000/api/tasks/task_abc123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"title":"PWNED","status":"done"}'
```

**Actual response (HTTP 200 — vulnerability confirmed):**
```json
{
  "task": {
    "id": "task_abc123",
    "title": "PWNED",
    "status": "done",
    "projectId": "proj_xyz789",
    "assignee": null
  }
}
```

**Expected response (after fix — HTTP 403):**
```json
{ "error": "you are not a member of this project" }
```

The attacker receives a `200 OK` with the mutated task object. A `viewer` from any project — or a user with zero project memberships — can silently alter any task's title, status, assignee, or position.

---

## Issue #2 — SQL Injection: Raw string interpolation in task search

| Field | Value |
|---|---|
| **File** | `src/app/api/projects/[id]/tasks/route.ts` lines 27–34 |
| **Category** | Security — SQL Injection (OWASP A03) |
| **Severity** | **Critical** |

### Description

When the `?q=` query parameter is present, the handler constructs a raw SQL string by direct string interpolation of both `projectId` and `q` into the query, then executes it with `prisma.$queryRawUnsafe`. Although `projectId` comes from the validated URL segment, `q` is entirely attacker-controlled. An attacker can break out of the `ILIKE` clause and execute arbitrary SQL — including `UNION`-based data exfiltration of other projects' tasks, user password hashes, or DDL commands, depending on the database role.

### Recommended Fix

Replace the raw query with a Prisma parameterized call:

```ts
const tasks = await prisma.task.findMany({
  where: {
    projectId,
    OR: [
      { title:       { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ],
  },
  orderBy: { position: "asc" },
});
```

Prisma generates a fully parameterized `$1` / `$2` query, eliminating the injection surface with no loss of functionality.

---

## Issue #3 — Data Integrity: `User.email` lacks a `@unique` database constraint

| Field | Value |
|---|---|
| **File** | `prisma/schema.prisma` lines 23–37 |
| **Category** | Data Integrity |
| **Severity** | **High** |

### Description

The `User` model declares `email String` without a `@unique` attribute, so the database has no constraint preventing duplicate email addresses. The registration handler (`src/app/api/auth/register/route.ts` line 17) performs an application-level `findFirst` check, but this creates a TOCTOU (time-of-check/time-of-use) race condition: two concurrent registration requests with the same email can both pass the check before either write completes, resulting in two `User` rows sharing the same email. This breaks the password-reset flow and allows a second actor to claim another user's identity.

### Recommended Fix

Add `@unique` to the `email` field in the schema and migrate:

```prisma
email  String  @unique
```

Additionally, wrap the `findFirst` + `create` pattern in a `prisma.$transaction` or rely solely on the unique constraint with a `try/catch` on `P2002` (unique constraint violation) to eliminate the race.

---

## Issue #4 — Performance: Full task row scan to compute `taskCount` in `GET /api/projects`

| Field | Value |
|---|---|
| **File** | `src/app/api/projects/route.ts` lines 10–30 |
| **Category** | Performance — N+1 / Over-fetching |
| **Severity** | **Medium** |

### Description

The project list endpoint includes `tasks: true` inside the Prisma `include`, causing the ORM to `SELECT *` every column of every task row for every project the user belongs to — purely to compute `taskCount: m.project.tasks.length` in JavaScript. For a user with 10 projects each containing 500 tasks, this loads 5,000 complete task records into the Node.js process across multiple round-trips. At scale this will cause memory pressure, slow list responses, and unnecessary database I/O. There is also no pagination on the returned projects list.

### Recommended Fix

Use Prisma's relational aggregation to push the `COUNT` to the database:

```ts
const memberships = await prisma.membership.findMany({
  where: { userId: user.id },
  include: {
    project: {
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },   // ← single COUNT(*) query
      },
    },
  },
  orderBy: { createdAt: "desc" },
  take: 50,   // add pagination
});

// then: taskCount: m.project._count.tasks
```

This generates a single `COUNT(*)` subquery per project instead of fetching full row data, and removes the in-process aggregation entirely.

---

## Summary Table

| # | Severity | Category | Location | Issue |
|---|---|---|---|---|
| 1 | Critical | Security / BOLA | `tasks/[id]/route.ts:16` | `PATCH` skips membership check — any user can mutate any task |
| 2 | Critical | Security / SQLi | `[id]/tasks/route.ts:27` | `$queryRawUnsafe` with unescaped user input in `?q=` parameter |
| 3 | High | Data Integrity | `schema.prisma:25` | `email` field has no `@unique` constraint — race allows duplicate accounts |
| 4 | Medium | Performance | `projects/route.ts:13` | `tasks: true` include fetches all task rows just to count them |
