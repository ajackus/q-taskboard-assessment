# Code Review

## Proposed New Features

1. **Add Project Functionality (UI)**
   - **Purpose:** Currently, the frontend functionality to create a new project is missing. Adding this feature is crucial so users can independently start and manage new initiatives without relying on backend seed data.

2. **Drag and Drop Kanban Task Management**
   - **Purpose:** The Kanban board lacks support for drag-and-drop task management. Implementing this is an essential usability feature that will drastically improve workflow and task organization, allowing users to intuitively move tasks between columns and prioritize them visually.

3. **Task Comments & Discussion Threads**
   - **Purpose:** We need a centralized way for team members to discuss specific tasks. Adding chronological, append-only comments ensures that all context, decisions, and updates remain attached to the task itself, creating a clear audit trail and reducing the need for external chat apps.

4. **Activity Feed & Audit Log**
   - **Purpose:** We need a chronological feed of recent activity at the project level. This gives managers and team members immediate visibility into what has changed (e.g., status changes, new tasks, assignee updates), fostering transparency and accountability across the project.

## Identified Issues

### 1. Insecure Direct Object Reference (IDOR) on Task Update
File: src/app/api/tasks/[id]/route.ts
Line: 16-35
Severity: Critical
Category: Security
Description: The `PATCH` handler for updating a task checks if the user is authenticated, but fails to verify if the user is actually a member of the project the task belongs to, or if they have permission to edit tasks. 
Impact: Any authenticated user across the entire application can modify or tamper with any task if they know or can guess its ID, leading to unauthorized data modification.
Recommended Fix: Fetch the existing task first, then use `getProjectMembership(user.id, task.projectId)` to verify the user is a member of the project, and check `canEditTasks(membership.role)` before proceeding with the update.
Proof (curl):
```bash
# As a user who does NOT have access to the project:
curl -X PATCH http://localhost:3000/api/tasks/TARGET-TASK-ID \
  -H "Authorization: Bearer <attacker_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title!"}'
```

### 2. SQL Injection in Task Search
File: src/app/api/projects/[id]/tasks/route.ts
Line: 27-33
Severity: Critical
Category: Security
Description: The search functionality uses `prisma.$queryRawUnsafe` and directly interpolates the user-provided `q` query parameter into the SQL string without sanitization or parameterization.
Impact: An attacker can append malicious SQL commands to the `q` parameter to extract sensitive data (like password hashes), drop tables, or tamper with the database.
Recommended Fix: Use `prisma.$queryRaw` with tagged template literals (which automatically parameterizes inputs) instead of `$queryRawUnsafe`, or rewrite the query using Prisma's native `where` API (e.g., `contains`, `mode: "insensitive"`).
Proof (curl):
```bash
# Injects a SQL payload to alter the query logic
curl -X GET "http://localhost:3000/api/projects/TARGET-PROJECT-ID/tasks?q=x';-- " \
  -H "Authorization: Bearer <token>"
```

### 3. Severe Over-fetching (Performance/Data Integrity) for Project List
File: src/app/api/projects/route.ts
Line: 16
Severity: High
Category: Performance
Description: When fetching the list of projects for a user, the query includes `tasks: true` just to calculate `m.project.tasks.length`. 
Impact: For a project with thousands of tasks, the database will return thousands of task records into server memory on every single project list request, causing enormous memory bloat, high latency, and potential out-of-memory crashes.
Recommended Fix: Remove `tasks: true` from the `include` block and instead use Prisma's relation count feature: `_count: { select: { tasks: true } }`.
Proof (curl):
```bash
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer <token>"
```

### 4. Unvalidated Task Assignment (Broken Business Logic)
File: src/app/api/projects/[id]/tasks/route.ts
Line: 79
Severity: High
Category: Data Integrity
Description: When creating (or updating) a task, the API accepts an `assigneeId` but never verifies whether this user is actually a member of the current project.
Impact: Users can assign tasks to people who are completely unrelated to the project, which can break the UI, cause notification bugs, and leak user IDs.
Recommended Fix: Before assigning a task, perform a quick database check to ensure that a `Membership` record exists between the requested `assigneeId` and the `projectId`.
Proof (curl):
```bash
curl -X POST http://localhost:3000/api/projects/TARGET-PROJECT-ID/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Task", "assigneeId": "RANDOM-NON-MEMBER-USER-ID"}'
```
