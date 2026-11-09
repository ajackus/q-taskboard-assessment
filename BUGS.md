## Unauthorized Task Modification
File : `src/app/api/tasks/[id]/route.ts:16-37`
Category : Security
Severity : Critical

Description : When an unauthenticated user sends a PATCH request to update a task belongsing to a project ther are not authorized to access, the app updates the task without verifiying project membership or user permission, but it should reject the request with 403 Forbidden. This vulnerability could allow unauthorized users to modify other team's tasks, potentially corrupting business-critical project data.

## Expose of Password Hashes in Project Details
File : `src/app/api/projects/[id]/route.ts:25-40`
Category : Security
Severity : High

Description : When a project member requests the project details endpoint, the app includes complete related user records for the owner, members, assignees, and task creators, potentially exposing password hashes in the API response, but it should return only explicitly permitted user fields. This created a sensitive data exposure risk and could increase the impact of a database or account compromise.

## SQL Injection in Task Search
File : `src/app/api/projects/[id]/tasks/route.ts:23-35`
Category : Security
Severity : High

Description : When a user submits a crafted search query to the task-list endpoint, the app interpolates the query directly into a SQL statement and executes it using $queryRawUnsafe, but it should treat the seach term strictly as data using parameterised queries. This could allow malicious input to alter database query behavior, expose task data, or cause database errors.

## Inefficiency Project Listing Query
File : `src/app/api/projects/route.ts:10-30`
Category : Performance
Severity : Medium

Description : When a user opens the project listing endpoint, the app retrives every task belonging to each project merely to calculate the task count, but it should fetch only the task counts requires by the response. As the number of projects and tasks increases, this unnecessary database work and data transfer can increase response times and memory consumption.

UI Bugs :
When a user clicks the Delete task detail modal, the app immediately sends a DELETE request without asking for confirmation, but it should ask the user to confirm the destructive action before deleting the task.

When a user opens the status dropdown while creating a task, the app displays internal value such as in_progress instead of user-friendly labels, but it should display readable labels such as "In Progress". This makes the interface less polished and can make status options harder to understand.