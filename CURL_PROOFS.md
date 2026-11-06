# Curl Proofs — copy/paste into the live, `script -a TERMINAL_LOG.txt` session

Server is already up via `docker compose` (bind-mounted, so it hot-reloads code changes —
no rebuild needed between the buggy and fixed states).

## Bug #1 — SQL injection in task search

Sequencing: the fix is currently applied on disk. `git stash` removes it (leaving the new
test file in place, since it's untracked) to demonstrate the red state, then
`git stash pop` restores it.

```bash
# 1. initial (red) test run — temporarily remove the fix to prove the new test catches the bug
git stash
npm test -- tasks-search

# 2. login as dev@example.com — a VIEWER on Q3 Launch (lowest privilege, still enough to attack)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

PID=$(curl -s http://localhost:3000/api/projects -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['projects'][0]['id'])")

echo "TOKEN=$TOKEN"
echo "PID=$PID"

# 3. BUG curl proof — UNION-based dump of every user's email + bcrypt password hash
curl -s -G "http://localhost:3000/api/projects/$PID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "q=nonexistent') UNION SELECT id, email, name, password_hash, 'todo'::\"TaskStatus\", id, id, 0, created_at, updated_at FROM users -- "

# 4. restore the fix
git stash pop

# 5. FIX curl proof — same payload now treated as a literal search string, no leak
curl -s -G "http://localhost:3000/api/projects/$PID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "q=nonexistent') UNION SELECT id, email, name, password_hash, 'todo'::\"TaskStatus\", id, id, 0, created_at, updated_at FROM users -- "

# 6. sanity — normal search still works after the fix
curl -s -G "http://localhost:3000/api/projects/$PID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "q=press release"

# 7. final (green) test run
npm test
```
