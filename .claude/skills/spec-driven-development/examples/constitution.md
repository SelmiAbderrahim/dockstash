# Example: ServerlessBase Project Constitution

## Core Principles

### Quality Standards
- All components must use semantic Tailwind tokens for automatic dark mode
- RTL support is mandatory for Arabic interface (use logical properties: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`)
- Touch targets minimum 44x44px for WCAG 2.1 AA compliance
- Code style follows existing patterns in the codebase
- TypeScript strict mode enforced (no `any` types)
- Test coverage minimum 80% for new features

### Technical Constraints
- Docker-only development - NEVER run commands on host machine
- Use `make shell-*` commands for container access
- tRPC API integration for backend communication
- TanStack Query for state management
- Shadcn UI components with custom styling
- No external dependencies without review
- Single `.env` file for all environment variables

### Architecture Rules
- Service components follow standard tab structure (general, environment, logs, monitoring, backups, advanced)
- URL tab state for all tabbed interfaces (query params)
- Design differentiation from ServerlessBase main app (no floating icon sidebar)
- Use semantic CSS custom properties for theming
- Follow service-tab-component-builder patterns
- Query keys follow existing factory pattern from `queryKeys.ts`

### Development Workflow
- All code must pass TypeScript type checking
- All code must pass Biome linting
- Tests required for new features
- Documentation required for public APIs
- Code reviewed for all changes
- PRs must pass CI/CD pipeline

### Security Standards
- Credentials never logged or displayed in plain text
- API keys stored in `.env` file only
- No hardcoded secrets in code
- Input validation on all user inputs
- SQL injection prevention via parameterized queries

## Project-Specific Rules

### Database Services
- Follow existing patterns from postgresService.ts
- Use tRPC router: `{service}` (e.g., `postgres`, `mysql`, `redis`)
- Implement tabs in order: general → environment → logs → monitoring → backups → advanced
- Provide real-time logs via WebSocket or polling
- Monitoring charts use Recharts library

### Application Services
- Follow deployment service patterns
- Support common operations: create, deploy, stop, restart, delete
- Show deployment status with badges (success, error, in-progress)
- Provide deployment logs viewer
- Support environment variables management

### UI Components
- Use Shadcn UI components as base
- Customize styling to differentiate from main app
- RTL support: use logical properties and icon mirroring
- Dark mode: use semantic tokens (`bg-card`, `text-foreground`)
- Mobile-first responsive design
- Loading states for all async operations
- Error boundaries for error handling

### API Integration
- Use tRPC for type-safe API calls
- Use TanStack Query for data fetching and caching
- Implement optimistic updates where appropriate
- Handle errors gracefully with user-friendly messages
- Retry failed requests with exponential backoff

## Testing Standards

### Unit Tests
- Test individual components in isolation
- Mock external dependencies (API, services)
- Cover happy path and error cases
- Use Vitest as test runner

### Integration Tests
- Test component integration with tRPC API
- Mock tRPC responses
- Verify data flow and state management

### E2E Tests
- Test critical user journeys
- Use Playwright for browser automation
- Test in multiple viewports (mobile, tablet, desktop)
- Test RTL layout with Arabic locale

## Documentation Standards

### Code Comments
- Add comments only for complex logic
- Don't comment obvious code
- Use JSDoc for public functions

### API Documentation
- Document public tRPC endpoints in `/docs/api/`
- Include request/response types
- Provide usage examples
- Note authentication requirements

### Component Documentation
- Document props with TypeScript types
- Provide usage examples
- Note accessibility features
- Document RTL support if applicable

## Performance Standards

### Load Time
- Initial render < 2 seconds
- Time to interactive < 3 seconds
- Lighthouse score 90+

### Runtime Performance
- API calls < 1000ms (95th percentile)
- Chart updates < 500ms
- Navigation transitions < 300ms

### Bundle Size
- Initial bundle < 200 KB gzipped
- Route chunks < 100 KB gzipped
- Lazy load non-critical features

## Accessibility Standards

### WCAG 2.1 AA Compliance
- Keyboard navigation for all interactive elements
- Screen reader support via ARIA attributes
- Color contrast minimum 4.5:1 for text
- Focus indicators visible on all focusable elements
- Touch targets minimum 44x44px

### RTL Support
- Use logical properties (`ms-`, `me-`, `ps-`, `pe-`)
- Mirror directional icons with `rtl:scale-x-[-1]`
- Test with Arabic locale (ar-SA)
- Use `flex-row rtl:flex-row-reverse` for directional content

## Deployment Standards

### Development
- Use Docker Compose for local development
- Run services in Docker containers
- Use `make start` to start development environment
- Use `make shell-*` for container access

### Production
- Build production bundles with optimizations
- Minify JavaScript and CSS
- Enable gzip compression
- Set appropriate cache headers
- Monitor error rates and performance

## Non-Negotiable Rules

1. **Docker-Only Development**: Never run `npm` or `node` commands on host machine
2. **TypeScript Strict**: No `any` types, all code type-safe
3. **RTL Support**: All UI components must support Arabic RTL layout
4. **Testing Required**: New features must have tests
5. **Linting Required**: All code must pass linting
6. **Single .env**: Never create additional environment files
7. **Design Differentiation**: Do not copy main app UI/UX patterns

## Enforcement

### Automated Checks
- TypeScript compiler (strict mode)
- Biome linter
- Vitest test runner
- CI/CD pipeline

### Code Review Checklist
- [ ] Follows project constitution
- [ ] Docker-only development compliance
- [ ] TypeScript type check passes
- [ ] Linting passes
- [ ] Tests written and passing
- [ ] RTL support verified
- [ ] Accessibility standards met
- [ ] Documentation updated

### Failure Consequences
- Non-compliant code rejected in PR review
- CI/CD pipeline fails on automated checks
- Developer must address issues before merge
