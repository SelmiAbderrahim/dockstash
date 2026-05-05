# MERN Feature Modules - Strict Rule

## MANDATORY REQUIREMENT

**Feature modules are the unit of organization. Cross-feature imports are forbidden except via `shared/` or each module's `index.js` re-exports.**

## Structure

```
client/src/
├── features/
│   ├── auth/
│   │   ├── components/    # Auth-specific React components
│   │   ├── actions.js     # Auth Redux actions
│   │   ├── reducer.js     # Auth Redux reducer
│   │   └── index.js       # Public API — re-exports what other features may use
│   ├── billing/
│   │   ├── components/
│   │   ├── actions.js
│   │   ├── reducer.js
│   │   └── index.js
│   └── dashboard/
│       ├── components/
│       ├── actions.js
│       ├── reducer.js
│       └── index.js
├── shared/
│   ├── components/        # Shared UI components (Button, Modal, etc.)
│   ├── reducers/          # Shared reducers (app-level state)
│   └── utils/             # Utility functions
└── index.js

server/
├── modules/
│   ├── auth/
│   │   ├── controller.js  # Route handlers
│   │   ├── model.js       # Mongoose model
│   │   ├── routes.js      # Express routes
│   │   └── index.js       # Public API
│   ├── billing/
│   │   ├── controller.js
│   │   ├── model.js
│   │   ├── routes.js
│   │   └── index.js
│   └── users/
│       ├── controller.js
│       ├── model.js
│       ├── routes.js
│       └── index.js
├── shared/
│   ├── middleware/         # Express middleware
│   ├── utils/             # Utility functions
│   └── config/            # Configuration
└── index.js
```

## Import Rules

### CORRECT

```javascript
// Importing from a feature's public API
import { LoginButton, authReducer } from "../auth";

// Importing shared utilities
import { formatDate } from "../../shared/utils";

// Feature importing its own internal files
import { validateEmail } from "./validators";
```

### FORBIDDEN

```javascript
// Reaching into another feature's internals
import { LoginForm } from "../auth/components/LoginForm";

// Importing a sibling feature's reducer directly
import { authReducer } from "../auth/reducer";

// Importing a server module's controller directly
import { createUser } from "../auth/controller";
```

## Module Public API (`index.js`)

Each module's `index.js` is its public interface. It re-exports the components, actions, reducers, and functions that other modules are allowed to use.

```javascript
// client/src/features/auth/index.js
export { default as LoginForm } from "./components/LoginForm";
export { default as SignupForm } from "./components/SignupForm";
export { login, logout, signup } from "./actions";
export { default as authReducer } from "./reducer";
```

```javascript
// server/modules/auth/index.js
export { default as authRoutes } from "./routes";
export { default as User } from "./model";
```

## When to Create a New Module

Create a new feature module when:
- It has its own data model (Mongoose schema / Redux state slice)
- It has 3+ components or route handlers
- It represents a distinct user-facing feature

Do NOT create a module for:
- A single utility function (put in `shared/utils/`)
- A single shared component (put in `shared/components/`)
- A one-off page that reuses existing modules

## Validation Checklist

- [ ] No direct imports from another feature's internal files
- [ ] Each module has an `index.js` public API
- [ ] Shared code lives in `shared/`, not duplicated across features
- [ ] New features follow the established module structure
