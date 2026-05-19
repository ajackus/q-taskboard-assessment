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
DATABASE_URL=postgresql://taskboard:taskboard@localhost:5432/taskboard_test?schema=public npm run test
```

## Part 3c Export Demo
*Note: Since the Airtable Personal Access Token and Base ID were not provided in the environment, the export runs using the `isTest` flag or falls back if real API keys are missing. The integration is fully implemented in `src/lib/airtable.ts` and tested via `npm test` using the mock.*

**To run the real integration:**
1. Add `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` to `.env`.
2. Ensure the "Tasks" table exists in your Airtable base with columns: `Task ID`, `Title`, `Description`, `Status`, `Assignee`.
3. Click "Export to Airtable" on the Project Detail page.
4. Check your Airtable base!
