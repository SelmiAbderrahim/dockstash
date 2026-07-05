# Interaction Hygiene - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every interactive element ships complete interaction affordances. New or changed
UI that lacks them is incomplete — a failing gate, not a follow-up.**

## Rules

1. **Pointer affordance.** Every clickable element shows `cursor: pointer` on hover
   — buttons, links, tabs, menu items, switches, clickable cards. Disabled controls
   show `cursor: not-allowed` with reduced opacity. Set on the base primitive
   (`Button`, `Link`) so it cascades — NEVER patched per call site.
2. **Every async action shows progress in place.** The moment an async-triggering
   control is clicked it: (1) disables immediately (no double-submit), (2) shows an
   in-button loading indicator — the shared `Spinner` via the `Button` `loading`
   prop, not swapped label text elsewhere — and (3) restores on success AND on
   error. ONE shared loading affordance app-wide; per-feature ad-hoc submitting
   flags are forbidden. Long-running restic jobs additionally stream visible
   progress (`ResticLogPanel`).
3. **All states designed.** Every interactive element ships: default, hover,
   focus-visible, active/pressed, disabled, and (where async) loading. No element
   ships with only a default state.
4. **No dead air.** Visible feedback within ~100ms of any click — optimistic update
   or spinner. Never a frozen UI with no signal the click registered.
5. **Keyboard parity.** Every hover affordance has a focus-visible equivalent;
   nothing is discoverable by mouse only.

## CORRECT

```tsx
<Button loading={isPending} onClick={onSubmit}>{t('save')}</Button>
```

## FORBIDDEN

```tsx
// WRONG — ad-hoc flag, label swap, no disable:
<Button onClick={onSubmit}>{isPending ? t('saving') : t('save')}</Button>
// WRONG — per-call-site cursor patch:
<div className="cursor-pointer" onClick={...}>
```

## Validation Checklist

- [ ] Clickables show `cursor: pointer`; disabled show `cursor: not-allowed`
- [ ] Async actions disable + show in-button `Spinner` via `loading`, restore on
      success and error
- [ ] All six states present on every interactive element
- [ ] Feedback within ~100ms; keyboard parity for every hover affordance
