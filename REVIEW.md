# Code Review

Four issues found by reading the codebase directly, ranked by business impact (largest
blast radius first). All curl proofs below were run against the seeded dev database and
any state changed during the demo (see issue #2) was reverted immediately afterward.

> **Note on terminal capture:** the curl proofs below were captured during exploration,
> outside of a recorded `script -a` terminal session. The formal before/after proof
> required for `TERMINAL_LOG.md` — including the Part 2 fix for issue #1 — will be
> re-run and captured live (via `script -a TERMINAL_LOG.txt`) in the next session, so
> `TERMINAL_LOG.md` reflects the actual recorded session rather than this prep work.
> `CURL_PROOFS.md` has copy-pasteable versions of these same commands for that re-run.

---

## 1. SQL Injection in task search — `src/app/api/projects/[id]/tasks/route.ts:23-36`

**Category:** Security
**Severity:** Critical

The `q` search parameter (and `projectId`) are string-interpolated directly into a raw
SQL string executed via `prisma.$queryRawUnsafe`:

```ts
const sql = `
  SELECT id, project_id, title, description, status, assignee_id, created_by_id, position, created_at, updated_at
  FROM tasks
  WHERE project_id = '${projectId}'
    AND (title ILIKE '%${q}%' OR description ILIKE '%${q}%')
  ORDER BY position ASC
`;
const tasks = await prisma.$queryRawUnsafe(sql);
```

Any authenticated project member — including a **viewer** — can inject arbitrary SQL
through `q`. Because the injected query ignores the intended `project_id` scoping
entirely, this isn't just an information leak within one project — it's an unauthenticated
read primitive against the whole database, including other tenants' data and every
user's bcrypt password hash.

**Recommended fix:** delete the raw SQL entirely and use Prisma's query builder, which
parameterizes automatically:

```ts
const tasks = await prisma.task.findMany({
	where: {
		projectId,
		...(q ?
			{
				OR: [
					{ title: { contains: q, mode: "insensitive" } },
					{ description: { contains: q, mode: "insensitive" } },
				],
			}
		:	{}),
	},
	include: { assignee: { select: { id: true, name: true, email: true } } },
	orderBy: [{ status: "asc" }, { position: "asc" }],
});
```

**Proof — a search for a non-matching string returns nothing, as expected:**

```
$ curl -s -G "http://localhost:3000/api/projects/$PID/tasks" \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "q=zzzznomatch"
{"tasks":[]}
```

**Proof — a crafted `q` value performs a UNION-based read of the `users` table,
dumping every user's email and password hash through what looks like a normal task
search:**

```
$ curl -s -G "http://localhost:3000/api/projects/$PID/tasks" \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "q=nonexistent') UNION SELECT id, email, name, password_hash, 'todo'::\"TaskStatus\", id, id, 0, created_at, updated_at FROM users -- "
{
  "tasks": [
    {
      "id": "cms4f9gtw0004oddreo2jdqsn",
      "project_id": "lina@example.com",
      "title": "Lina Joshi",
      "description": "$2a$10$qcsbXzKHGxbyG9AOyeW8NeOF3RNWHlSClngLFm0t7rypSLRMC3rwu",
      ...
    },
    { "title": "Kavya Reddy", "description": "$2a$10$qcsbXzKHGxbyG9AOyeW8NeOF3RNWHlSClngLFm0t7rypSLRMC3rwu", ... },
    { "title": "Dev Sharma",  "description": "$2a$10$qcsbXzKHGxbyG9AOyeW8NeOF3RNWHlSClngLFm0t7rypSLRMC3rwu", ... },
    { "title": "Meera Iyer",  "description": "$2a$10$qcsbXzKHGxbyG9AOyeW8NeOF3RNWHlSClngLFm0t7rypSLRMC3rwu", ... },
    { "title": "Arjun Rao",   "description": "$2a$10$qcsbXzKHGxbyG9AOyeW8NeOF3RNWHlSClngLFm0t7rypSLRMC3rwu", ... }
  ]
}
```

(The response's `title`/`description` fields are actually `users.name`/`users.password_hash`
— the endpoint has been repurposed into a full user-table dump via a single query
parameter, by an attacker who only needed viewer access to any one project.)

---

## 2. IDOR / Broken Object-Level Authorization — `src/app/api/tasks/[id]/route.ts:16-38`

**Category:** Security
**Severity:** Critical

`PATCH /api/tasks/[id]` checks that the task exists but never checks the caller's
relationship to the task's project — no `getProjectMembership`/`canEditTasks` call at
all. Compare this to `DELETE` in the same file (lines 40-57), which correctly checks
both. As written, **any authenticated user** — including someone who just self-registered
and has never been invited to any project — can modify the title, description, status,
or assignee of any task in any project.

**Recommended fix:** add the same membership + role check `DELETE` already has:

```ts
const membership = await getProjectMembership(user.id, existing.projectId);
if (!membership) return forbidden("you are not a member of this project");
if (!canEditTasks(membership.role))
	return forbidden("viewers cannot edit tasks");
```

**Proof — a freshly self-registered attacker with zero project memberships successfully
mutates a task belonging to a project they've never been invited to:**

```
$ curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
    -d '{"email":"attacker-poc@example.com","password":"password123","name":"Attacker"}'
{"user":{"id":"cms4m91t60005od4aa9es7loq", ...},"token":"eyJhbGci..."}

$ curl -s -i -X PATCH "http://localhost:3000/api/tasks/$TASK_ID" \
    -H "Authorization: Bearer $ATTACKER_TOKEN" -H "Content-Type: application/json" \
    -d '{"title":"PWNED by attacker-poc@example.com"}'
HTTP/1.1 200 OK
{"task":{"id":"cms4f9gu2000voddr4kqbtrlw","title":"PWNED by attacker-poc@example.com", ...}}
```

The task title was reverted to its original seeded value (`Prepare customer email
blast`) immediately after capturing this proof, via a legitimate authenticated PATCH,
to avoid leaving modified seed data behind.

---

## 3. Password hash exposed in API responses — `src/app/api/projects/[id]/route.ts:25-40`

**Category:** Security
**Severity:** High

`GET /api/projects/[id]` (and the analogous includes elsewhere: task `assignee`/
`createdBy`, project `memberships.user`) fetch related users via Prisma `include: { owner: true, ... }`
rather than `select: { id, name, email }`. `include` pulls the _entire_ `User` model,
including `passwordHash`, and `NextResponse.json(project)` serializes it straight into
the HTTP response. Every project member can currently see every other member's bcrypt
hash — including the project owner's — just by loading the project page.

**Recommended fix:** replace every `include: { owner: true }` / `include: { user: true }`
/ `include: { assignee: true, createdBy: true }` with an explicit `select` limited to
`{ id, name, email }`.

**Proof:**

```
$ curl -s "http://localhost:3000/api/projects/$PID" -H "Authorization: Bearer $TOKEN"
{
  "owner": {
    "id": "cms4f9gtu0000oddrammay5g3",
    "email": "meera@taskboard.dev",
    "name": "Meera Iyer",
    "passwordHash": "$2a$10$qcsbXzKHGxbyG9AOyeW8NeOF3RNWHlSClngLFm0t7rypSLRMC3rwu",
    ...
  }
}
```

---

## 4. No unique constraint on `User.email` — `prisma/schema.prisma:23-37`

**Category:** Data Integrity
**Severity:** Medium

`email` has no `@unique` attribute, and both `POST /api/auth/register` and
`POST /api/auth/login` use `prisma.user.findFirst({ where: { email } })` instead of
`findUnique`. Register does check for an existing row first, but that check-then-create
is not atomic — two concurrent registrations with the same email can both pass the
existence check and both succeed, leaving two rows with the same email. At that point,
login becomes non-deterministic: `findFirst` with no `orderBy` has no guaranteed
ordering, so which account's password is checked (and which account's session is
issued) is left up to Postgres/Prisma's default row order.

**Recommended fix:** add `@unique` to `User.email` in the schema (migration adds a
unique index, which also makes concurrent duplicate registration fail at the DB level
instead of racing), and switch both routes to `findUnique({ where: { email } })`.

---

## Additional finding

### JWT stored in `localStorage` instead of an httpOnly cookie — `src/lib/api-client.ts:8-32`

**Category:** Security
**Severity:** Low-Medium (latent — no confirmed active exploit path today)

`getToken`/`getStoredUser`/`setSession`/`clearSession` all read/write the JWT and user
object via `window.localStorage`. Any JavaScript running on the page — including code
injected via a future XSS bug — can read `localStorage.getItem("taskboard_token")` and
exfiltrate the session outright, whereas an httpOnly cookie is invisible to
`document`/`window` JS entirely and can't be read this way even if XSS exists elsewhere.

This is ranked separately from the top 4, not folded in, because there is currently no
confirmed XSS injection point in the app (no `dangerouslySetInnerHTML`/`innerHTML`
usage anywhere in `src/`, and React escapes rendered text by default) — so today this is
a hardening gap that would turn a _future_ XSS bug into full session takeover, rather
than an issue that's independently, actively exploitable right now the way the SQL
injection and IDOR are.

**Recommended fix:** issue the JWT as an httpOnly, `Secure`, `SameSite=Lax` (or `Strict`)
cookie set by the server (`Set-Cookie` header on login/register responses) instead of
returning it in the JSON body for client-side storage; read it server-side via
`req.cookies` in `getCurrentUser` instead of parsing an `Authorization` header sourced
from `localStorage`.
