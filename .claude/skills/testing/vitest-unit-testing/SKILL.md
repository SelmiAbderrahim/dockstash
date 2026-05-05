---
name: vitest-unit-testing
description: >
  Vitest unit testing patterns with React Testing Library, mock setup, assertion patterns, and 90%+ coverage enforcement.
---

# Vitest Unit Testing Skill

## Quick Start

**Purpose**: Master Vitest for comprehensive unit testing with 90%+ coverage enforcement

**Key Concepts**:
- Component isolation testing
- Mock and spy setup
- Assertion patterns
- Coverage reporting

## Installation

```bash
# In Docker container
make client CMD="npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom"
```

## Basic Component Test

```typescript
// src/components/Button/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

## Running Tests

```bash
# Run all tests
make test

# Run specific file
make client CMD="npm test Button.test.tsx"

# Run with coverage
make test:coverage

# Watch mode
make client CMD="npm test -- --watch"
```

## Coverage Requirements

- **Lines**: 90%+
- **Functions**: 90%+
- **Branches**: 90%+
- **Statements**: 90%+

## Common Patterns

See `guide.md` for:
- Mock setup and spies
- Fixture creation
- Assertion patterns
- React hooks testing
- Async testing

## Troubleshooting

See `troubleshooting.md` for:
- Coverage gaps
- Flaky tests
- Mock issues
- DOM testing problems
