# Terminal Log

## Setup Output
```bash
> npm install
added 485 packages, and audited 486 packages in 12s
...
> npx prisma db push
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database
...
```

## Initial Test Run
```bash
> npm test

> taskboard@0.1.0 test
> vitest run

The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.

 RUN  v2.1.8 D:/Hardik Work/project/Hardik/assesment/q-taskboard-assessment

 ✓ src/tests/schemas.test.ts (7 tests)
 ✓ src/tests/auth.test.ts (2 tests)
 ✓ src/tests/TaskCard.test.tsx (3 tests)

 Test Files  3 passed (3)
      Tests  12 passed (12)
   Start at  07:45:30
   Duration  1.88s (transform 98ms, setup 541ms, collect 340ms, tests 107ms, environment 2.34s, prepare 411ms)
```

## Bug (Before Fix) - cURL Proof
```bash
curl -X PATCH http://localhost:3000/api/tasks/cmppkx4wz0001n4f8ecwa4jfw \
  -H "Authorization: Bearer <attacker_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title!"}'

# Result (200 OK - Task modified by unauthorized user):
{"task":{"id":"cmppkx4wz0001n4f8ecwa4jfw","projectId":"cmppkvfch000jn4gspegw4m6v","title":"Hacked Title!","description":"ds","status":"review","assigneeId":null,"createdById":"cmppkvfc70000n4gs55xh9pes","position":0,"createdAt":"2026-05-28T14:19:21.252Z","updatedAt":"2026-05-29T02:16:45.632Z","assignee":null}}
```

## Fix (After Fix) - cURL Proof
```bash
curl -X PATCH http://localhost:3000/api/tasks/cmppkx4wz0001n4f8ecwa4jfw \
  -H "Authorization: Bearer <hacker_token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title 2!"}'

# Result (403 Forbidden - Access properly denied):
{"error":"you are not a member of this project"}
```

## Part 3a/3b - Feature Demos

- **3a**: [View Screenshot](https://prnt.sc/LtVnCtxLXvCo)
- **3b**: [View Screenshot](https://prnt.sc/N_hRI6JDX6M0)

## Part 3c - Airtable Export Demo

- **First Run (Screenshot)**: [View Screenshot](https://prnt.sc/cS1ATW7vXNOI)
- **Second run to show uniqueness (no duplicates created)**: [Watch on Loom](https://www.loom.com/share/dbdd44f6c03d43a6b73f4b65efa45c44)

## Final Test Run

```bash
> npm test

> taskboard@0.1.0 test
> vitest run

 ✓ src/tests/activity.test.ts (2)           
 ✓ src/tests/airtable.test.ts (8)                       
 ✓ src/tests/auth.test.ts (2)                                    
 ✓ src/tests/comments.test.ts (3)                          
 ✓ src/tests/schemas.test.ts (7)                                                                   
 ✓ src/tests/TaskCard.test.tsx (3)                                    
 ✓ src/tests/tasks-route.test.ts (3)                    
                                                                 
 Test Files  7 passed (7)                                  
      Tests  28 passed (28)                      
   Start at  19:54:06                                                 
   Duration  1.92s (transform 415ms, setup 1.12s, collect 1.49s, tests 331ms, environment 5.00s, prepare 879ms)
```
