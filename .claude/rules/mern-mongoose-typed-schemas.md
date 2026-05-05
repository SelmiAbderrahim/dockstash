# MERN Mongoose Typed Schemas - Strict Rule

## MANDATORY REQUIREMENT

**Every Mongoose schema MUST be typed via `InferSchemaType` (or equivalent) and the type must be exported alongside the model.** This ensures type safety across the codebase and prevents runtime surprises from schema-model mismatches.

## Pattern

### JavaScript (Current Stack)

Since the current MERN starter uses plain JavaScript, enforce explicit JSDoc typing on every schema:

```javascript
const mongoose = require("mongoose");

/**
 * @typedef {Object} UserDocument
 * @property {string} email
 * @property {string} passwordHash
 * @property {"user"|"admin"} role
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

/** @type {mongoose.Model<UserDocument>} */
const User = mongoose.model("User", userSchema);

module.exports = { User };
```

### TypeScript (Future Migration)

When migrating to TypeScript, use `InferSchemaType`:

```typescript
import mongoose, { InferSchemaType } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"] as const, default: "user" },
  },
  { timestamps: true }
);

type UserDocument = InferSchemaType<typeof userSchema>;

const User = mongoose.model("User", userSchema);

export { User, type UserDocument };
```

## Rules

1. **Every schema gets a type** — Either JSDoc `@typedef` or TypeScript `InferSchemaType`
2. **Type is exported alongside the model** — Consumers import both
3. **Schema options are explicit** — Always declare `{ timestamps: true }` or `{ timestamps: false }`; never rely on defaults
4. **Enum values are typed** — Use string literal unions, not `any`
5. **Required fields are marked** — Schema `required: true` must appear in the type as non-optional

## Schema Structure

Each model file follows this structure:

```javascript
// 1. Imports
const mongoose = require("mongoose");

// 2. Type definition (JSDoc or TypeScript)
/** @typedef {...} */

// 3. Schema definition
const schema = new mongoose.Schema({ ... }, { timestamps: true });

// 4. Virtuals, methods, hooks (optional)
schema.virtual("fullName").get(function () { /* ... */ });
schema.pre("save", function (next) { /* ... */ });

// 5. Model creation
const Model = mongoose.model("Name", schema);

// 6. Named exports
module.exports = { Model };
```

## FORBIDDEN

```javascript
// WRONG - no type annotation
const User = mongoose.model("User", new mongoose.Schema({ email: String }));
module.exports = User;

// WRONG - schema and model in different files without shared types
// schema.js
module.exports = new mongoose.Schema({ ... });
// model.js
module.exports = mongoose.model("User", require("./schema"));

// WRONG - loose String without validation
email: String  // should have required, unique, lowercase, trim
```

## Validation Checklist

- [ ] Every schema has an associated type (JSDoc `@typedef` or `InferSchemaType`)
- [ ] Type is exported alongside the model
- [ ] Required fields are marked `required: true` in schema
- [ ] Enum fields use explicit values, not open-ended strings
- [ ] Schema options are explicit (`timestamps`, `toJSON`, etc.)
- [ ] No bare `mongoose.model()` calls without a type annotation
