# Code Review

Here are the top 4 issues found in the TaskBoard application, prioritized by business impact.

## 1. Broken Object Level Authorization (IDOR) on Tasks
*   **File**: `src/app/api/tasks/[id]/route.ts` (Line 29)
*   **Category**: Security
*   **Severity**: Critical
*   **Description**: The `PATCH` endpoint for modifying tasks fetches the existing task by ID and updates it immediately. It completely fails to verify if the authenticated user has permission to edit tasks in the associated project (or if they are even a member of the project). Any authenticated user can modify any task in the entire database if they know or guess its ID.
*   **Recommended Fix**: Add a project membership and role check before allowing the update. Retrieve the project ID from the existing task, call `getProjectMembership`, and verify that `canEditTasks(membership.role)` returns true.

### Bug in Action
**Request (as a Viewer who should not have edit access):**
```bash
curl -s -X PATCH \
  -H "Authorization: Bearer <viewer_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title"}' \
  http://localhost:3000/api/tasks/cmpc6o7h6000vp9pb56qvfhpk
```

**Response:**
```json
{
  "task": {
    "id": "cmpc6o7h6000vp9pb56qvfhpk",
    "projectId": "cmpc6o7gu0006p9pbu5rdnmt3",
    "title": "Hacked Title",
    "description": "Detail for: Prepare customer email blast",
    "status": "todo",
    "assigneeId": "cmpc6o7gq0002p9pbw3utl9v3",
    "createdById": "cmpc6o7gn0000p9pbrndgo8wl",
    "position": 4,
    "createdAt": "2026-05-19T05:19:29.755Z",
    "updatedAt": "2026-05-19T05:22:17.818Z",
    "assignee": {
      "id": "cmpc6o7gq0002p9pbw3utl9v3",
      "name": "Kavya Reddy",
      "email": "kavya@example.com"
    }
  }
}
```

## 2. SQL Injection Vulnerability in Task Search
*   **File**: `src/app/api/projects/[id]/tasks/route.ts` (Lines 27-34)
*   **Category**: Security
*   **Severity**: Critical
*   **Description**: The `GET` endpoint implements search functionality using `prisma.$queryRawUnsafe` with raw template literals that inject the user-provided `q` parameter directly into the SQL query. An attacker can craft malicious input to extract arbitrary database records or execute destructive SQL commands.
*   **Recommended Fix**: Use `prisma.$queryRaw` with tagged template literals (which safely parameterize the query) or rewrite the logic using Prisma's standard `findMany` with the `OR` and `contains` operators.

## 3. Missing Unique Constraint on User Email
*   **File**: `prisma/schema.prisma` (Line 25)
*   **Category**: Data Integrity / Security
*   **Severity**: Critical
*   **Description**: The `User` model lacks a `@unique` constraint on the `email` field, allowing multiple user accounts to be created with the exact same email address. Since the `/api/auth/login` endpoint uses `findFirst` to look up the user by email, login behavior will become nondeterministic, potentially logging a user into the wrong account or allowing account takeover.
*   **Recommended Fix**: Add the `@unique` attribute to the `email` field in `prisma/schema.prisma` (i.e. `email String @unique`) and create a database migration to apply the constraint.

## 4. Severe Performance Degradation on Project Listing (N+1-like Memory Bloat)
*   **File**: `src/app/api/projects/route.ts` (Lines 16 and 29)
*   **Category**: Performance
*   **Severity**: High
*   **Description**: The `/api/projects` endpoint fetches all projects for the current user and includes the entire `tasks` relation array (`tasks: true`) just to calculate `taskCount: m.project.tasks.length`. If projects contain thousands of tasks, this queries all task rows and loads them entirely into Node.js memory, causing severe slowdowns, excessive bandwidth usage between DB and server, and potential Out-Of-Memory (OOM) crashes.
*   **Recommended Fix**: Use Prisma's `_count` aggregation feature (`_count: { select: { tasks: true } }`) so the database computes the count natively without sending back all the task records over the network.
