# Plan: Fix empty folder/docker listing when Agent VPS selected

## 1. Investigation

### 1.1 The two code paths

| Aspect | Local server ("storage VPS") | Fleet agent ("agent VPS") |
|---|---|---|
| Folder source | Server reads `/var/www` **live** (`server/.../backups.discover.ts:72-101`) | Cached snapshot agent pushed via heartbeat (`server/.../agents.discovery.ts:84-108`) |
| Docker source | Server queries Docker **live** via socket proxy (`backups.discover.ts:229-244`) | Same cached snapshot — `dockerAvailable` flag set by agent |
| Connection | Direct filesystem access | Outbound-only — server never reaches agent (`docs/fleet-agents.en.md:9`) |
| Endpoint | `GET /backups/discover/folders`, `GET /backups/discover/containers` | `GET /agents/:agentId/discovery` |
| Freshness | Real-time | Up to ~120s stale (`poller.ts:102`) |
| Manual path tab | Enabled | **Disabled** (`AddProjectScreen.tsx:265`) |

### 1.2 Root cause of empty listing on agent VPS

`buildAgentDiscoveryView()` collapses three distinct conditions into the same `EMPTY_VIEW` (`agents.discovery.ts:47-52,85`):

1. **Agent never heartbeated** → `agent.discovery === null` → `EMPTY_VIEW`
2. **Agent reported but `/var/www` not mounted** → `collectFolders()` returns `[]` (`agent/src/discovery.ts:89-95`)
3. **Agent reported but socket proxy down** → `dockerAvailable: false` (`agent/src/discovery.ts:132-140`)

All three produce identical UI output — operator can't tell which.

### 1.3 UI bug to verify

You quoted local-only hint strings: `"No subdirectories under /var/www"` and `"No Docker socket is configured on this server"` (`projects.json:52,57`). When `isAgent` is true, the code at `AddProjectScreen.tsx:277,320` should show agent-specific hints. Either:
- `isAgent` is false at render time (state bug — verify in React DevTools), or
- You're seeing the agent-specific hints and paraphrasing them

---

## 2. Agent VPS deployment verification (do this first)

Before coding, verify the actual agent VPS deployment. The compose template (`agent/docker-compose.agent.yml`) requires two mounts; if either is missing, discovery is empty.

### 2.1 Check agent status in dashboard

1. Open the Fleet page (`/fleet` or wherever agents are listed)
2. Confirm the agent shows **online** — `effectiveAgentStatus()` counts offline when `lastSeenAt` older than `AGENT_OFFLINE_AFTER_SECONDS` (`agents.service.ts:151-158`)
3. Note the `lastSeenAt` timestamp — if stale, the agent daemon may be down

### 2.2 SSH into the agent VPS and inspect

```bash
# 1. Confirm both containers are running
docker compose -f docker-compose.agent.yml ps
# Expect: agent UP, docker-socket-proxy UP

# 2. Confirm the agent can see /var/www from inside the container
docker compose -f docker-compose.agent.yml exec agent ls -la /var/www
# Expect: your project subdirectories. If empty/missing → mount broken.

# 3. Confirm the socket proxy is reachable from the agent
docker compose -f docker-compose.agent.yml exec agent \
  wget -qO- http://docker-socket-proxy:2375/containers/json | head -c 200
# Expect: JSON array of running containers. 403/empty → proxy misconfigured.

# 4. Check the agent daemon logs for discovery warnings
docker compose -f docker-compose.agent.yml logs agent | rg "discovery:"
# Look for: "project root unreadable" or "Docker unreachable"
```

### 2.3 Common deployment failures

| Symptom | Cause | Fix |
|---|---|---|
| Agent offline in Fleet | Daemon not running / wrong `DOCKSTASH_URL` / wrong token | Verify `docker compose up -d`, check token format `dsa_<id>.<secret>` |
| `/var/www` empty in container | Volume mount missing | Add `- /var/www:/var/www:ro` to agent service |
| Socket proxy 403 | `CONTAINERS: 1` env not set on proxy | Verify proxy env block (`docker-compose.agent.yml:14-18`) |
| Discovery payload rejected | Shape mismatch (schema drift after upgrade) | Check server logs for Zod `safeParse` failure on heartbeat (`agent-api.controller.ts:40-43`) |

### 2.4 If deployment is correct but still empty

If the agent IS online, mounts ARE present, proxy IS reachable, but Fleet still shows empty — then the bug is in the data flow (Problems 1-4 below) and the code fixes are needed.

---

## 3. Fixes

### Fix A: Distinguish null vs empty snapshot in discovery view

**File:** `server/src/modules/agents/agents.discovery.ts`
- Add `reported: boolean` to `AgentDiscoveryView` (line 40-45)
- Set `reported: !!snapshot` in both `EMPTY_VIEW` and the build result (lines 47-52, 102-107)
- Lets UI tell "never reported" apart from "reported empty"

### Fix B: Surface discovery errors from agent

**Files:**
- `agent/src/discovery.ts` — add `errors: string[]` to `AgentDiscoverySnapshot` (line 28-32); push human-readable strings when `collectFolders` fails (line 91-95) and when Docker throws (line 136-139)
- `server/src/modules/agents/agents.model.ts` — add `errors: [string]` to `agentDiscoverySchema` (lines 40-48)
- `server/src/modules/agents/agent-api.schema.ts` — add `errors: z.array(z.string()).optional()` to `agentDiscoveryInput` (lines 39-43); keep salvage-on-fail behavior
- `server/src/modules/agents/agents.discovery.ts` — pass-through `errors` in build result

### Fix C: Richer agent empty states in UI

**File:** `client/src/features/projects/components/AddProjectScreen.tsx` (lines 272-281, 315-324)
- When `isAgent && !reported`: show "Agent hasn't reported yet" with last-seen time and link to Fleet page
- When `isAgent && reported && errors.length > 0`: render the error list (e.g., "/var/www not readable", "Docker socket proxy unreachable")
- When `isAgent && reported && empty && errors.length === 0`: existing agent empty hint

**File:** `client/src/features/projects/types.ts` — add `reported: boolean`, `errors: string[]` to `AgentDiscoveryView` (lines 63-68)

### Fix D: Show agent online/offline status in picker

**File:** `client/src/features/projects/components/AddProjectScreen.tsx` (lines 213-239)
- The agent list already has `status` and `lastSeenAt` (`fleet/types.ts:3-10`) — surface them in the dropdown and snapshot-age text (lines 230-238)
- If agent is offline, show a warning badge and disable the folder/docker tabs

### Fix E: Verify and fix `isAgent` rendering bug

**File:** `client/src/features/projects/components/AddProjectScreen.tsx:277,320`
- Add a runtime guard: log `isAgent` + `target` when rendering empty state to confirm the ternary resolves correctly
- If confirmed buggy, ensure `target` state doesn't reset to `LOCAL` after agents list loads

### Fix F: Add "Refresh snapshot now" button

This requires a server→agent signal since the server cannot reach the agent directly. Design:

**Server side:**
- `server/src/modules/agents/agents.model.ts` — add `discoveryRequestedAt: Date | null` to agent schema (default null)
- `server/src/modules/agents/agents.routes.ts` — add `POST /:agentId/discovery/refresh` (user-facing); sets `discoveryRequestedAt = now`
- `server/src/modules/agents/agent-api.controller.ts` — in the heartbeat handler, after persisting, check if `agent.discoveryRequestedAt > agent.discovery.snapshotAt`; if so, include `{ refreshDiscovery: true }` in the response body and clear `discoveryRequestedAt`
- `server/src/modules/agents/agent-api.schema.ts` — document the response shape

**Agent side:**
- `agent/src/api-client.ts` — `heartbeatOnce` must read and return the response body (currently fire-and-forget at `api-client.ts:62-69`)
- `agent/src/poller.ts:132-145` (`heartbeatOnce`) — if response contains `refreshDiscovery: true`, invalidate the snapshot cache so `snapshotForHeartbeat` recomputes immediately on the next tick (bypass the 120s throttle at `poller.ts:102`)
- `agent/src/poller.ts:99-120` (`snapshotForHeartbeat`) — add a `force?: boolean` parameter that skips the cache check

**Client side:**
- `client/src/features/projects/api.ts` — add `refreshAgentDiscoveryRequest(agentId)` → `POST /agents/:agentId/discovery/refresh`
- `client/src/features/projects/store/thunks.ts` — add `refreshAgent` thunk
- `client/src/features/projects/components/AddProjectScreen.tsx` — add a "Refresh" button next to the snapshot-age text (lines 230-238); on click, dispatch thunk, show spinner, then re-dispatch `discoverAgent` after a short delay (next heartbeat lands within ~30s)

### Fix G: Improve agent deployment docs

**File:** `agent/docker-compose.agent.yml` — add comment warning that removing either mount breaks discovery
**File:** `docs/fleet-agents.en.md` — add a "Troubleshooting empty folders" section listing the three failure modes and the SSH checks from §2.2

---

## 4. Tests

### 4.1 Server unit tests

**File:** `server/src/modules/agents/agents.discovery.test.ts`
- `buildAgentDiscoveryView(null)` returns `reported: false`, empty arrays
- `buildAgentDiscoveryView({folders:[], containers:[], dockerAvailable:false})` returns `reported: true`
- `buildAgentDiscoveryView({...,errors:["/var/www unreadable"]})` passes errors through
- `buildAgentDiscoveryView` with valid snapshot returns `reported: true`, derived plans, passthrough errors

**File:** `server/src/modules/agents/agent-api.controller.test.ts`
- Heartbeat with `errors` in discovery payload persists them
- Heartbeat with malformed `errors` field salvages the rest (keeps heartbeat, drops discovery)
- Heartbeat response includes `refreshDiscovery: true` when `discoveryRequestedAt > snapshotAt`
- Heartbeat response clears `discoveryRequestedAt` after signaling refresh
- Heartbeat response omits `refreshDiscovery` when not requested

**File:** `server/src/modules/agents/agents.routes.test.ts`
- `POST /:agentId/discovery/refresh` sets `discoveryRequestedAt` on the agent doc
- Requires auth + verified + multi-VPS entitlement

### 4.2 Agent unit tests

**File:** `agent/src/discovery.test.ts`
- `collectFolders` with unreadable root returns `[]` and pushes error string
- `collectDiscovery` with throwing docker client sets `dockerAvailable: false` and pushes error string
- Snapshot includes `errors: []` on happy path
- `collectFolders` skips non-directories and symlinks
- `collectFolders` respects `MAX_FOLDERS` limit

**File:** `agent/src/poller.test.ts`
- `snapshotForHeartbeat({force: true})` recomputes ignoring cache age
- `snapshotForHeartbeat({force: false})` uses cache when fresh
- `heartbeatOnce` reads response body and triggers cache invalidation when `refreshDiscovery: true`

### 4.3 Client tests

**File:** `client/src/features/projects/components/AddProjectScreen.test.tsx` (extend lines 357-451)
- Agent never reported (`reported: false`) → shows "Agent hasn't reported yet" copy
- Agent reported empty with errors → shows error list
- Agent reported empty without errors → shows existing agent hint
- Local target → shows local hint (regression guard)
- Offline agent → shows warning badge, tabs disabled
- Refresh button click → dispatches `refreshAgent` thunk
- Refresh button hidden for local target

**File:** `client/src/features/projects/store/thunks.test.ts`
- `refreshAgent` calls `refreshAgentDiscoveryRequest` with correct agentId

**File:** `client/src/features/projects/api.test.ts`
- `refreshAgentDiscoveryRequest` sends `POST /agents/:id/discovery/refresh`

---

## 5. Execution order

1. **Deploy verification** (§2) — SSH/logs first to confirm whether it's operational or code
2. **Fix A + B** (server/agent data model: `reported`, `errors`) — foundation
3. **Fix F** (refresh mechanism: model + routes + agent poller + client thunk) — backend backbone
4. **Fix C + D + E** (UI: richer empty states, status badge, isAgent guard) — depends on A/B/F
5. **Tests** for all layers (§4)
6. **Fix G** (docs) — last
