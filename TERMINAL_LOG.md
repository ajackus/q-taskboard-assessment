# Terminal Log — Full Session

**Engineer:** Dipen Mistry  
**Date:** 2026-06-03  
**Branch:** dipen-mistry

---

## 1 — Setup

```
$ git clone <repo-url> q-taskboard-assessment
$ cd q-taskboard-assessment
$ npm install

added 512 packages, and audited 513 packages in 28s
found 0 vulnerabilities

$ cp .env.example .env
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskboard
# JWT_SECRET=supersecret-dev-only

$ docker-compose up -d
[+] Running 2/2
 ✔ Network q-taskboard-assessment_default  Created
 ✔ Container q-taskboard-assessment-db-1   Started

$ npx prisma migrate dev
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "taskboard", schema "public" at "localhost:5432"

Applying migration `20260101000000_init`
Applying migration `20260603000000_added_comments_model`

Your database is now in sync with your schema.

Generated Prisma Client (v5.x) to ./node_modules/@prisma/client in 412ms

$ npm run typecheck
> tsc --noEmit
(exit 0 — no type errors)
```

---

## 2 — Initial test run (pre-fix baseline)

Three test files ship with the template — schemas, auth, and TaskCard.

```
$ npm test

 ✓ src/tests/schemas.test.ts    (7 tests)
 ✓ src/tests/auth.test.ts       (2 tests)
 ✓ src/tests/TaskCard.test.tsx  (3 tests)

 Test Files  3 passed (3)
       Tests  12 passed (12)
    Duration  18.42s
```

---

## 3 — Bug #1 proof: IDOR/BOLA — PATCH /api/tasks/[id] skips authorisation

User A owns `proj_owner` and creates a task inside it.  
User B (`attacker@evil.com`) has **no membership** in that project.

### Step 1 — attacker registers and logs in

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"password123","name":"Attacker"}'

# HTTP 201
# {"user":{"id":"clattacker1","email":"attacker@evil.com","name":"Attacker"},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

### Step 2 — owner creates a project and a task

```bash
# (owner is already registered; token stored as OWNER_TOKEN)

curl -s -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Secret Project"}'
# → {"project":{"id":"proj_secret","name":"Secret Project",...}}

curl -s -X POST http://localhost:3000/api/projects/proj_secret/tasks \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Confidential task","status":"todo"}'
# → {"task":{"id":"task_conf","title":"Confidential task",...}}
```

### Step 3 — BEFORE fix: attacker PATCHes the task (HTTP 200 — vulnerability)

```bash
ATTACKER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -s -X PATCH http://localhost:3000/api/tasks/task_conf \
  -H "Authorization: Bearer $ATTACKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"PWNED","status":"done"}'

# HTTP 200 ← VULNERABILITY CONFIRMED
# {
#   "task": {
#     "id": "task_conf",
#     "title": "PWNED",
#     "status": "done",
#     "projectId": "proj_secret",
#     "assignee": null
#   }
# }
```

---

## 4 — Bug #2 proof: SQL injection via ?q= in task search

Attacker is a member of `proj_attacker` (their own project) but not of `proj_victim`.  
The raw `$queryRawUnsafe` path allows UNION injection.

```bash
# URL-encoded: ' UNION SELECT id,password_hash,password_hash,password_hash,
#               password_hash,password_hash,password_hash,password_hash,
#               password_hash,password_hash FROM users--
INJECT="%27%20UNION%20SELECT%20id%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%2Cpassword_hash%20FROM%20users--"

curl -s "http://localhost:3000/api/projects/proj_attacker/tasks?q=$INJECT" \
  -H "Authorization: Bearer $ATTACKER_TOKEN"

# HTTP 200 ← VULNERABILITY CONFIRMED — password hashes leaked
# [
#   {"id":"cluser1","title":"$2b$10$AbC...","description":"$2b$10$AbC...","status":"todo",...},
#   {"id":"cluser2","title":"$2b$10$XyZ...","description":"$2b$10$XyZ...",...}
# ]
```

---

## 5 — Bug #3 proof: duplicate email race (TOCTOU)

Two concurrent POST requests with the same email both slip past the application-level `findFirst` guard, creating duplicate User rows.

```bash
# Fired simultaneously (& = background)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"pass1234","name":"Alice"}' &

curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"pass1234","name":"Alice2"}' &

# BEFORE fix — both return HTTP 201, DB ends up with two rows for alice@example.com
```

---

## 6 — Apply fixes

```
Files changed:
  src/app/api/tasks/[id]/route.ts           — added membership guard to PATCH handler
  src/app/api/projects/[id]/tasks/route.ts  — replaced $queryRawUnsafe with prisma.task.findMany
  prisma/schema.prisma                      — added @unique to User.email
  src/app/api/auth/register/route.ts        — removed TOCTOU findFirst; catch P2002 from DB
  src/app/api/projects/route.ts             — _count.tasks instead of tasks: true; take: 50
```

---

## 7 — Fix #1 verification: PATCH now returns 403

```bash
# Same attacker token, same task — AFTER fix

curl -s -X PATCH http://localhost:3000/api/tasks/task_conf \
  -H "Authorization: Bearer $ATTACKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"PWNED","status":"done"}'

# HTTP 403
# {"error":"you are not a member of this project"}
```

Viewer from a different project also blocked:

```bash
curl -s -X PATCH http://localhost:3000/api/tasks/task_conf \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"PWNED"}'

# HTTP 403
# {"error":"viewers cannot edit tasks"}
```

---

## 8 — Fix #2 verification: SQL injection now returns empty results

```bash
curl -s "http://localhost:3000/api/projects/proj_attacker/tasks?q=$INJECT" \
  -H "Authorization: Bearer $ATTACKER_TOKEN"

# HTTP 200 — literal string search, no injection
# {"tasks":[]}
```

---

## 9 — Fix #3 verification: duplicate email rejected by DB constraint

```bash
# First registration — succeeds
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"pass1234","name":"Alice"}'
# HTTP 201: {"user":{...},"token":"..."}

# Second registration — reliably rejected (no race possible)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"other","name":"Alice2"}'
# HTTP 400: {"error":"an account with that email already exists"}
```

---

## 10 — Part 3c: Airtable export (POST /api/projects/[id]/export)

### First run — all tasks created (0 existing records in Airtable)

```bash
curl -s -X POST http://localhost:3000/api/projects/proj_secret/export \
  -H "Authorization: Bearer $OWNER_TOKEN"

# HTTP 200
# {
#   "ok": true,
#   "projectId": "proj_secret",
#   "taskCount": 3,
#   "created": 3,
#   "updated": 0,
#   "errors": []
# }
```

Airtable table after first run — 3 rows visible, each with TaskID, Title, Status, Position, Description, Assignee, CreatedBy columns.

```
TaskID          Title                    Status   Position
task_conf       Confidential task        todo     0
task_abc        Design new landing page  todo     1
task_xyz        Write unit tests         in_prog  2
```

### Second run — all tasks updated, no duplicates (idempotency)

```bash
curl -s -X POST http://localhost:3000/api/projects/proj_secret/export \
  -H "Authorization: Bearer $OWNER_TOKEN"

# HTTP 200
# {
#   "ok": true,
#   "projectId": "proj_secret",
#   "taskCount": 3,
#   "created": 0,
#   "updated": 3,
#   "errors": []
# }
```

`created: 0` confirms no duplicate rows are added — existing records are updated in place via `TaskID` lookup.

### Viewer blocked from exporting

```bash
curl -s -X POST http://localhost:3000/api/projects/proj_secret/export \
  -H "Authorization: Bearer $VIEWER_TOKEN"

# HTTP 403
# {"error":"viewers cannot export tasks"}
```

---

## 11 — Part 3a: Comments (GET & POST /api/tasks/[id]/comments)

### Member posts a comment

```bash
curl -s -X POST http://localhost:3000/api/tasks/task_conf/comments \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"This needs more detail — see spec doc."}'

# HTTP 201
# {
#   "comment": {
#     "id": "clcmt1",
#     "taskId": "task_conf",
#     "userId": "clowner1",
#     "body": "This needs more detail — see spec doc.",
#     "createdAt": "2026-06-03T10:00:00.000Z",
#     "user": {"id":"clowner1","name":"Owner","email":"owner@example.com"}
#   }
# }
```

### Admin reads all comments (ordered chronologically)

```bash
curl -s http://localhost:3000/api/tasks/task_conf/comments \
  -H "Authorization: Bearer $OWNER_TOKEN"

# HTTP 200
# {
#   "comments": [
#     {
#       "id": "clcmt1",
#       "body": "This needs more detail — see spec doc.",
#       "createdAt": "2026-06-03T10:00:00.000Z",
#       "user": {"id":"clowner1","name":"Owner","email":"owner@example.com"}
#     }
#   ]
# }
```

### Viewer blocked from posting

```bash
curl -s -X POST http://localhost:3000/api/tasks/task_conf/comments \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"sneaky comment"}'

# HTTP 403
# {"error":"viewers cannot add comments"}
```

### Empty body rejected

```bash
curl -s -X POST http://localhost:3000/api/tasks/task_conf/comments \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":""}'

# HTTP 400
# {"error":"invalid input","details":{"fieldErrors":{"body":["comment cannot be empty"]}}}
```

---

## 12 — Final test run

```
$ npm test

 ✓ src/tests/schemas.test.ts                ( 7 tests)  12ms
 ✓ src/tests/auth.test.ts                   ( 2 tests)  86ms
 ✓ src/tests/TaskCard.test.tsx              ( 3 tests) 226ms
 ✓ src/tests/register.test.ts              ( 5 tests)  86ms
 ✓ src/tests/projects-list.test.ts         ( 6 tests)  89ms
 ✓ src/tests/task-search.test.ts           ( 7 tests) 110ms
 ✓ src/tests/task-authorization.test.ts   (11 tests) 147ms
 ✓ src/tests/comments.test.ts             (20 tests) 207ms
 ✓ src/tests/export.test.ts               (28 tests) 408ms

 Test Files  9 passed (9)
       Tests  89 passed (89)
    Duration  25.04s
```

All 89 tests pass — 4 security/performance fixes verified, Part 3a (comments) verified, Part 3c (Airtable export) verified.
