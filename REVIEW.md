# Code Review

## 1. SQL Injection in Task Search

* File: `src/app/api/projects/[id]/tasks/route.ts`
* Category: Security
* Severity: Critical

The task search endpoint builds SQL using string interpolation and executes it via `prisma.$queryRawUnsafe()`. An attacker can inject arbitrary SQL through the `q` parameter and potentially access or modify data outside the intended scope.

Recommended Fix:
Replace raw SQL with Prisma query filters or parameterized queries.

### Proof

```bash
curl "http://localhost:3000/api/projects/project-id/tasks?q=' OR 1=1 --"
```

Response:

```json
[
  ...
]
```

The query returns records outside the intended search criteria.

---

## 2. Missing Authorization on Task Updates

* File: `src/app/api/tasks/[id]/route.ts`
* Category: Security
* Severity: Critical

The PATCH endpoint updates tasks without verifying project membership. Any authenticated user can potentially modify tasks belonging to projects they are not a member of.

Recommended Fix:
Validate project membership and role before performing updates.

---

## 3. Project Listing Loads Entire Task Collections

* File: `src/app/api/projects/route.ts`
* Category: Performance
* Severity: Medium

Projects are fetched together with complete task collections when only task counts are required. This increases query time and memory consumption as projects grow.

Recommended Fix:
Use Prisma `_count` instead of loading full task records.

---

## 4. Insufficient Test Coverage for Authorization Rules

* File: API test suite
* Category: Testing
* Severity: Medium

Authorization rules for task updates, project membership checks, and role restrictions are not sufficiently covered by automated tests. Security regressions could be introduced without detection.

Recommended Fix:
Add integration tests for admin/member/viewer permissions and cross-project access attempts.
