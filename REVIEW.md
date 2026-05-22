# Code Review — Top Issues (by Business Impact)

Issues below are ordered by business impact: open security/auth problems first, then resolved product gaps that previously blocked core workflows.

---

## 1. Stale session token not cleared on login page

| | |
|---|---|
| **Status** | Open |
| **File / line** | [`src/app/login/page.tsx`](src/app/login/page.tsx) (lines 8–30); [`src/lib/api-client.ts`](src/lib/api-client.ts) (`clearSession` at lines 29–32, only used from [`src/components/Header.tsx`](src/components/Header.tsx) lines 17–19) |
| **Category** | Security |
| **Severity** | High |

The login page never calls `clearSession()` when it mounts or when navigation lands on `/login`. A JWT and user object can remain in `localStorage` after sign-out, a failed session, or visiting login from another flow. Protected routes still treat the user as authenticated via `getToken()`, which creates inconsistent UX and weakens the guarantee that the login screen represents an unauthenticated state.

**Recommended fix:** On mount of the login page (and optionally register), call `clearSession()` before rendering the form. Alternatively, centralize auth in a layout or middleware that clears invalid/expired tokens and redirects consistently. Keep `clearSession()` on explicit sign-out in `Header` as well.

---

## 2. Browser back/forward bypasses login boundary

| | |
|---|---|
| **Status** | Open |
| **File / line** | [`src/app/page.tsx`](src/app/page.tsx) (lines 9–12); [`src/app/login/page.tsx`](src/app/login/page.tsx) (lines 24–25, `router.push` after login) |
| **Category** | Security |
| **Severity** | High |

The landing route (`/`) immediately `replace`s to `/dashboard` when any token exists in `localStorage`, without re-validating credentials. From the login page, using the browser **Back** button can return to `/`, which then sends the user to the dashboard while the login UI implied they were logged out. **Forward** can also restore dashboard access from history without a fresh login if a token is still stored (see issue 1).

**Recommended fix:** Clear session when entering `/login`. Avoid auto-redirect to `/dashboard` from `/` based only on token presence; prefer a short auth check (e.g. validate JWT or call `/api/users/me`) or use `router.replace` after login with `history.replaceState` so back from login does not land on a token-gated hop. Consider a dedicated post-logout route that does not auto-forward authenticated-looking clients.

---

## 3. No way to create new projects from the dashboard

| | |
|---|---|
| **Status** | Fixed |
| **File / line** | [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) (lines 66–72 add control; lines 75–120 create form; lines 43–57 `POST /api/projects` mutation) |
| **Category** | Architecture |
| **Severity** | Critical (when unfixed) |

Originally the dashboard only listed projects with no UI to create one, even though `POST /api/projects` existed. New users could not onboard work in the app without seed data or API calls, which blocked the primary product loop.

**Recommended fix:** Implemented — “add project” toggle, form (name, description, read-only owner), and mutation with query invalidation. No further action unless regressions appear.

---

## 4. No way to add or update project members (non-owner roles)

| | |
|---|---|
| **Status** | Fixed |
| **File / line** | [`src/app/projects/[id]/page.tsx`](src/app/projects/[id]/page.tsx) (lines 127–147 “edit project”; lines 247–252 `ProjectDetail`); [`src/components/ProjectDetail.tsx`](src/components/ProjectDetail.tsx); [`src/app/api/projects/[id]/members/route.ts`](src/app/api/projects/[id]/members/route.ts) and [`src/app/api/projects/[id]/members/[membershipId]/route.ts`](src/app/api/projects/[id]/members/[membershipId]/route.ts) |
| **Category** | Architecture |
| **Severity** | High (when unfixed) |

Originally the project page showed a read-only member list with no way for admins to invite users as `member` or `viewer` or change roles. Team collaboration and task assignment depended on seed memberships only.

**Recommended fix:** Implemented — admin-only “edit project” modal with member add (user dropdown + role), role updates, and removal; backed by membership APIs. Ensure Airtable/export and task flows stay aligned with membership rules.

---

## Summary

| Priority | Issue | Status |
|----------|--------|--------|
| 1 | Token not cleared on login | Open |
| 2 | Back/forward auth bypass via `/` + stored token | Open |
| 3 | No add-project on dashboard | Fixed |
| 4 | No project member management | Fixed |

