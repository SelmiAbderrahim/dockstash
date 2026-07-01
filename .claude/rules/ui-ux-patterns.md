# UI/UX Patterns - Best Practice Guide

> **UPDATE (shadcn/ui adoption).** The client has migrated to **shadcn/ui + Tailwind v4**
> with a fresh, modern shadcn default aesthetic. shadcn's component variants and design
> tokens (`client/src/styles/tailwind.css`) are now the source of truth for look-and-feel,
> and they **supersede** the strict "anti-Codex" visual constraints below (button/card
> radius values, no-gradient, pill-shape, transition rules). Do NOT hand-fight shadcn
> defaults to satisfy those specific rules. Use `@shared/ui/*` primitives and semantic
> tokens (`bg-primary`, `text-muted-foreground`, …) rather than raw colors.
>
> **Still fully in force:** the **Accessibility**, **Touch & Interaction**, **Forms &
> Feedback**, **Loading/Error states**, and **responsive/layout** sections below, plus
> "no emoji as icons" (use lucide-react) and light/dark contrast parity. Prefer existing
> shadcn components over custom markup (Alert, Empty, Skeleton, Badge, Separator, Sonner).

## MANDATORY REQUIREMENT

All UI components MUST follow these patterns. Build interfaces that feel human-designed, functional, and honest — not like default AI-generated output.

## Anti-Codex Principles

AI-generated UIs share recognizable tells: card lift effects, decorative animations, shadow escalation, gradient text, glassmorphism, pill-shaped buttons, and excessive rounded corners. Eliminate them.

| Element | Correct | Wrong |
|---------|---------|-------|
| Cards | Flat, `border: 1px solid`, subtle shadow or none | Lift on hover (`translateY`), shadow escalation |
| Buttons | `border-radius: 6px`, solid fill or outline | Pill shape (`border-radius: 9999px`), gradient fill |
| Transitions | `color` or `opacity`, 150ms max | `all`, 300ms+, with transforms |
| Shadows | One subtle shadow level, or none | Escalating shadows on hover |
| Typography | System font stack, regular weights | Multiple decorative fonts, gradient text |
| Spacing | 4/8/12/16/24/32px consistent scale | Arbitrary values (`13px`, `22px`) |
| Status indicators | Static badge with semantic color | Pulsing or bouncing animations |
| Hover states | Background color change | Scale transforms, shadow escalation |

## Banned Patterns

| Pattern | Why | Alternative |
|---------|-----|-------------|
| Card lift on hover | AI-generated tell | Background or border-color change |
| Bounce animation | Decorative, distracting | Spin on loader icon for loading only |
| Pulse on badges/buttons | False urgency | Static badge with semantic color |
| `transition: all` | Over-broad, causes layout shifts | `transition: color` or `transition: opacity` |
| Transition duration > 200ms | Sluggish feel | 150ms max |
| Over-rounded containers (`>12px`) | Toy-like appearance | 8px for cards, 6px for buttons |
| Gradient backgrounds | Decorative, not functional | Solid background color |
| Gradient text | AI-generated signature | Solid text color |
| Backdrop blur / glassmorphism | Hurts readability, decorative | Solid background |
| Scale on hover | Zoom effect is an AI tell | No scale transforms on hover |
| Hidden-until-hover content | Undiscoverable | Always-visible inline actions |

## Accessibility Requirements

### Keyboard Navigation

- All interactive elements MUST be reachable via `Tab` key
- Focus indicators MUST be visible (never `outline: none` without a replacement)
- Modal dialogs MUST trap focus and return focus on close
- Dropdowns MUST support `Escape` to close, arrow keys to navigate
- Use semantic HTML: `<button>` for actions, `<a>` for navigation, `<input>` for form fields

### ARIA

- Add `aria-label` to icon-only buttons
- Use `role="alert"` for error messages that appear dynamically
- Use `aria-live="polite"` for status updates (loading, success)
- Use `aria-expanded` on toggleable elements
- Use `aria-describedby` to link form fields to their error messages

### Loading States

- Show a spinner or skeleton while data loads — never a blank screen
- Disable submit buttons during submission to prevent double-clicks
- Show loading text alongside spinners (e.g. "Saving...")
- Use consistent loading indicators across the app

### Error States

- Display validation errors inline, next to the relevant field
- Show a clear error message (not just a red border)
- Provide actionable guidance (e.g. "Password must be at least 8 characters")
- Use color + text for errors — never color alone

## Color Guidelines

1. **Define a palette** — Use CSS custom properties for all colors
2. **Semantic naming** — `--color-primary`, `--color-error`, `--color-success`
3. **Dark mode** — Support via `prefers-color-scheme` or a toggle; all components MUST work in both modes
4. **Contrast** — Minimum 4.5:1 contrast ratio for body text (WCAG AA)
5. **Never hardcode hex** — Use the defined custom properties everywhere

## Animation Rules

| Allowed | Context | Duration |
|---------|---------|----------|
| Spin | Loading spinners only | Continuous |
| `color` / `opacity` transition | Hover/focus state changes | 150ms max |
| Fade in/out | Show/hide elements | 150ms max |

| Banned | Why |
|--------|-----|
| Bounce | Decorative, distracting |
| Pulse (on non-skeleton elements) | False urgency |
| Scale on hover | AI-generated tell |
| Lift on hover | AI-generated tell |
| Duration > 200ms on interactive elements | Sluggish |

## Validation Checklist

- [ ] No card lift / translate on hover
- [ ] No bounce or pulse animations (except skeleton placeholders)
- [ ] No gradient text or backgrounds on UI components
- [ ] Button border-radius <= 8px
- [ ] Card border-radius <= 12px
- [ ] All interactive elements keyboard-reachable
- [ ] Focus indicators visible on all interactive elements
- [ ] Loading states shown for all async operations
- [ ] Error messages are inline, text-based, and actionable
- [ ] Colors use CSS custom properties, not hardcoded hex
- [ ] Minimum 4.5:1 contrast ratio on body text
