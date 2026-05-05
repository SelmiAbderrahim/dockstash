---
name: Debug Issue
description: Systematically debug issues in the MERN stack using search-based code navigation
---

## Debug Issue

Systematically trace and debug issues across the Express API, Mongoose data layer, and React/Redux client.

### Steps

1. **Reproduce and scope the issue:**
   - Determine the layer: client (React/Redux), server (Express), or database (Mongoose).
   - Check the browser console for client-side errors.
   - Check the server terminal for Express/Mongoose errors.
   - If the server is not running: `npm run dev` (from `server/`).

2. **Search for related code:**
   ```bash
   grep -rn "<error-message-or-symbol>" client/src/ server/src/ --include="*.js"
   ```

3. **Trace the request lifecycle:**
   - Client action: `grep -rn "<actionCreator>" client/src/features/ --include="*.js"`
   - API call: `grep -rn "<endpoint>" server/src/modules/ --include="*.js"`
   - Express route: check `server/src/modules/<feature>/routes.js`
   - Controller handler: check `server/src/modules/<feature>/controller.js`
   - Mongoose query: check `server/src/modules/<feature>/model.js`

4. **Check recent changes:**
   ```bash
   git log --oneline -10
   git diff HEAD~1 -- server/src/ client/src/
   ```

5. **Isolate the failure:**
   - Add `console.log` or use `debug` at the boundary between layers.
   - For Mongoose issues: check connection string in root `.env`, verify `MONGODB_URI`.
   - For Express issues: check error middleware in `server/src/shared/middleware/`.
   - For Redux issues: use Redux DevTools to inspect dispatched actions and state changes.

### Common MERN Issues

| Symptom | Likely Cause | Where to Look |
|---------|-------------|---------------|
| `ECONNREFUSED` | MongoDB not running | Start `mongod`; check `MONGODB_URI` in `.env` |
| `ValidationError` | Mongoose schema mismatch | Check `server/src/modules/<feature>/model.js` |
| `CastError` | Invalid ObjectId in query | Check route params in `controller.js` |
| `Unhandled Promise Rejection` | Missing `async/await` or `.catch()` | Add error handling to route handlers |
| State not updating | Wrong reducer key or action type | Check `reducer.js` and `actions.js` in the feature |
| 404 on API call | Route not registered or wrong path | Check `routes.js` and main `server/index.js` mounting |
| CORS error | `CLIENT_URL` mismatch in `.env` | Check Express CORS config and root `.env` |

### Tips

- Start at the error location and work outward to the entry point.
- Check both the client action and the server handler — bugs often live in the contract between them.
- Use `npm test` (from `server/`) to run existing tests and check for regressions.
- Recent changes are the most common source of new issues.
