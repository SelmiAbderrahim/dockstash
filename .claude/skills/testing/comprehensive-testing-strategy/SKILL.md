---
name: comprehensive-testing-strategy
description: >
  Complete testing strategy covering unit, integration, and E2E testing with coverage enforcement and CI/CD integration.
---

# Comprehensive Testing Strategy Skill

## Quick Start

**Purpose**: Understand and implement a complete testing strategy with proper coverage across all layers

**Key Concepts**:
- Testing pyramid
- Test-Driven Development (TDD)
- Coverage enforcement
- Continuous testing

## Testing Pyramid

```
      /\
     /  \  E2E Tests (5%)
    /----\
   /      \  Integration Tests (15%)
  /--------\
 /          \ Unit Tests (80%)
/____________\
```

## Test Coverage Breakdown

**Unit Tests (80%)**: Fast, focused, isolated
- Component rendering
- Hook behavior
- Utility functions
- Error handling

**Integration Tests (15%)**: Multiple components
- Feature workflows
- API interactions
- State management
- Complex scenarios

**E2E Tests (5%)**: Complete user flows
- Critical paths only
- Cross-browser validation
- Performance benchmarks
- Accessibility compliance

## Implementation Strategy

### Phase 1: Unit Testing (Week 1-2)
```bash
# Target: 90%+ coverage
npm run test:coverage

# Focus on:
# - Component rendering
# - Props handling
# - Event handlers
# - Conditional rendering
```

### Phase 2: Integration Testing (Week 3)
```bash
# Test features end-to-end at API level
npm run test:integration

# Focus on:
# - Multi-component workflows
# - API mocking
# - State changes
# - Error scenarios
```

### Phase 3: E2E Testing (Week 4)
```bash
# Test critical user paths
npm run test:e2e

# Focus on:
# - Login/signup flows
# - Video upload workflows
# - Transcription viewing
# - Search functionality
```

## Coverage Requirements

| Layer | Coverage | Tools | Time |
|-------|----------|-------|------|
| Unit | 90%+ | Vitest | Fast |
| Integration | 100% pass | Vitest + MSW | Medium |
| E2E | Critical paths | Playwright | Slow |
| Security | Zero critical | npm audit | Fast |
| Performance | FCP<1.5s | Lighthouse | Medium |
| Accessibility | WCAG AA | axe-core | Fast |

## Test File Organization

```
src/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       ├── Button.test.tsx       # Unit
│       ├── Button.visual.test.ts # Visual
│       └── Button.a11y.test.ts   # Accessibility
├── hooks/
│   ├── useVideoList.ts
│   └── __tests__/
│       └── useVideoList.test.ts
└── pages/
    ├── Dashboard.tsx
    └── __tests__/
        └── Dashboard.integration.test.tsx

tests/
├── e2e/
│   ├── flows/                    # User workflows
│   │   ├── login.spec.ts
│   │   └── uploadVideo.spec.ts
│   ├── pages/                    # Page objects
│   │   ├── LoginPage.ts
│   │   └── DashboardPage.ts
│   ├── a11y/                     # Accessibility
│   │   └── navigation.spec.ts
│   └── performance/              # Performance
│       └── metrics.spec.ts
└── fixtures/                     # Test data
    └── mockData.ts
```

## Command Reference

```bash
# Run all tests
npm run test

# Run specific layer
npm run test:unit
npm run test:integration
npm run test:e2e

# Generate coverage
npm run test:coverage

# Watch mode
npm run test -- --watch

# Debug mode
npm run test -- --debug
```

## Best Practices

1. **Write tests before code (TDD)**
2. **Keep tests focused and fast**
3. **Mock external dependencies**
4. **Test behavior, not implementation**
5. **Maintain >90% coverage**
6. **Run tests in CI/CD**
7. **Keep E2E tests minimal**
8. **Document complex test logic**

## See Also

- `guide.md` - Detailed implementation patterns
- `patterns.md` - Common testing recipes
- `troubleshooting.md` - Issue resolution

## Reference Files

- `/prompts/agents/testing/unit-test-specialist.md`
- `/prompts/agents/testing/e2e-playwright-specialist.md`
- `/prompts/agents/testing/security-test-specialist.md`
- `/prompts/agents/testing/performance-test-engineer.md`
- `/prompts/agents/testing/accessibility-test-expert.md`
