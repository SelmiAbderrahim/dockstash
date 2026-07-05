# Shared Layout System - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Exactly one Header, one Footer, one shell system — building blocks live in
`client/src/shared/components/`; every surface composes a variant of them. Adding a
page NEVER means hand-rolling a new header or footer.**

## Rules

1. **Two variants, one system.** App variant = the SPEC-01 sidebar shell (framed
   main column, grouped sidebar, topbar, in-frame footer). Marketing variant =
   top-nav + sitemap footer. Both composed from the same shared building blocks —
   never inlined `<header>`/`<footer>` markup inside feature layouts, never a
   second visual language.
2. **Consistent chrome everywhere.** Same sticky height and z-index; mobile menu =
   `Sheet` on every surface; `ThemeToggle` + locale switcher present on both
   variants; `GuideWidget` mounts once, in the app shell.
3. **Every label internationalized** via `t(...)` in all 7 locales — no
   hardcoded-English chrome strings.
4. **A user never visibly crosses layout styles mid-funnel** (marketing → register
   → setup wizard → dashboard).

## FORBIDDEN

```tsx
// WRONG — feature layout inlining its own chrome:
export const SomeFeatureLayout = () => (
  <div>
    <header>...</header>   {/* belongs to the shared shell */}
    ...
  </div>
);
```

## Validation Checklist

- [ ] No `<header`/`<footer` markup inside `client/src/features/**` layouts
- [ ] New pages render inside an existing shell variant
- [ ] Chrome labels resolve through `t(...)` in all 7 locales
- [ ] `Sheet` mobile menu, `ThemeToggle`, locale switcher on every surface
