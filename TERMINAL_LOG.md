# Terminal Log

## Initial Setup & Test Run
```bash
npm install
docker compose up -d db
npm run setup
npm test
```

## Bug Proof (Before Fix)
Exploiting IDOR vulnerability as a viewer to modify a task:
```bash
curl -s -X PATCH \
  -H "Authorization: Bearer <viewer_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title"}' \
  http://localhost:3000/api/tasks/cmpc6o7h6000vp9pb56qvfhpk
```
**Output:**
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
    "updatedAt": "2026-05-19T05:22:17.818Z"
  }
}
```

## Bug Proof (After Fix)
```bash
curl -s -X PATCH \
  -H "Authorization: Bearer <viewer_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title 2"}' \
  http://localhost:3000/api/tasks/cmpc6o7h6000vp9pb56qvfhpk
```
**Output:**
```json
{
  "error": "viewers cannot edit tasks"
}
```

## Final Test Run
```bash
npm run test -- --no-file-parallelism
```
**Output:**
```
✓ src/tests/airtable-export.test.ts (3)
✓ src/tests/tasks-comments.test.ts (3)
✓ src/tests/tasks-idor.test.ts (2)
✓ src/tests/schemas.test.ts (7)
✓ src/tests/TaskCard.test.tsx (3)
✓ src/tests/auth.test.ts (2)

 Test Files  6 passed (6)
      Tests  20 passed (20)
```

## Part 3c Export Demo
*Note: The Airtable Personal Access Token and Base ID have been configured in `.env` using real credentials.*

**To run the real integration:**
1. Ensure the "Tasks" table exists in your Airtable base with columns: `Task ID`, `Title`, `Description`, `Status`, `Assignee`.
2. Visit the Project Detail page.
3. Click "Export to Airtable".
4. Check your Airtable base (`https://airtable.com/appMhL3cAKyYwo7Nn/tblvVB6IPPEzAUGEL/viwooUJAnl3tMxUL8`) and see the 12 seeded tasks successfully synchronized.
5. Clicking Export again will perform an idempotent update, updating the existing records.
