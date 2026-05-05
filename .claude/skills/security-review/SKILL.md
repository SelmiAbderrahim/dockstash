---
name: security-review
description: AI-powered security review adapted from Anthropic's claude-code-security-review. Runs deep semantic security analysis locally using Claude Code CLI. Supports multiple scan modes (full, branch, targeted, deps, secrets, auth, api, docker, pipeline). Use when the user asks for security review, security audit, vulnerability scan, or mentions security concerns.
---

# Security Review Skill

## Trigger Keywords
`security review`, `security audit`, `vulnerability scan`, `security scan`, `pentest`, `sec review`, `find vulnerabilities`, `check security`, `audit code`, `/security-review`

## Overview

This skill runs AI-powered security analysis on the ServerlessBase codebase, adapted from [Anthropic's claude-code-security-review](https://github.com/anthropics/claude-code-security-review) for local execution via Claude Code CLI.

## Scan Modes

| Mode | Command | Description |
|------|---------|-------------|
| `full` | `/security-review` or `/security-review full` | Deep audit of entire codebase |
| `branch` | `/security-review branch` | Review current branch changes only |
| `targeted` | `/security-review targeted path/to/dir` | Audit specific files/directories |
| `deps` | `/security-review deps` | Dependency & supply chain audit |
| `secrets` | `/security-review secrets` | Hardcoded secrets scan |
| `auth` | `/security-review auth` | Authentication & authorization audit |
| `api` | `/security-review api` | tRPC API endpoint audit |
| `docker` | `/security-review docker` | Docker & infrastructure audit |
| `pipeline` | `/security-review pipeline` | Full pipeline: scan + filter + report |

## Workflow

### Step 1: Determine Scan Mode
Parse the user's request to determine which mode to run. Default to `branch` if on a feature branch, `full` if on main/master.

### Step 2: Run Security Scan
Execute the appropriate scan based on mode. Use the corresponding prompt from `prompts/security-review/`:

- `full` → `02-full-repo-audit.md`
- `branch` → `03-branch-diff-review.md`
- `targeted` → `04-targeted-file-audit.md`
- `deps` → `05-dependency-audit.md`
- `secrets` → `06-secrets-scan.md`
- `auth` → `07-auth-flow-audit.md`
- `api` → `08-api-endpoint-audit.md`
- `docker` → `09-docker-infra-audit.md`

### Step 3: Apply False Positive Filter
Filter findings using the rules in `prompts/security-review/13-custom-fp-filtering.md`:

**Hard Exclusions:**
- DoS / resource exhaustion
- Rate limiting concerns
- React XSS without `dangerouslySetInnerHTML`
- Client-side auth gaps
- Docker-internal network traffic
- Test files, documentation
- SSRF in client-side code
- AI prompt injection (intentional)

**Confidence Threshold:** Only report findings with confidence >= 0.7

### Step 4: Generate Report
For `pipeline` mode or on request, generate reports in `security-reports/`:
- JSON report: `security-reports/report-YYYY-MM-DD.json`
- Markdown report: `security-reports/report-YYYY-MM-DD.md`

## Output Format

All scans output structured JSON:

```json
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "HIGH",
      "category": "command_injection",
      "description": "User input passed to docker exec without sanitization",
      "exploit_scenario": "Attacker injects shell commands via container name",
      "recommendation": "Validate input against alphanumeric pattern",
      "confidence": 0.95
    }
  ],
  "analysis_summary": {
    "files_reviewed": 0,
    "high_severity": 0,
    "medium_severity": 0,
    "low_severity": 0,
    "review_completed": true
  }
}
```

## Severity Guidelines

| Severity | Criteria | Confidence |
|----------|----------|------------|
| HIGH | Directly exploitable: RCE, data breach, auth bypass | >= 0.9 |
| MEDIUM | Requires specific conditions, significant impact | >= 0.8 |
| LOW | Defense-in-depth issues | >= 0.7 |

## ServerlessBase Context

| Layer | Technology | Key Security Concerns |
|-------|-----------|----------------------|
| Frontend | React 18, TypeScript, Shadcn UI | XSS only via dangerouslySetInnerHTML |
| Backend | tRPC, Drizzle ORM, PostgreSQL | Injection via raw SQL, auth bypass |
| Auth | better-auth (sessions, cookies) | Session management, IDOR |
| Infra | Docker, Nginx/Traefik | Container escape, proxy misconfig |
| AI | WebSmith, App Studio | Sandbox escape, resource abuse |
| Payments | Stripe, LemonSqueezy | Webhook bypass, price manipulation |

## Related Files

- **Prompts**: `prompts/security-review/` (14 files)
- **Agent**: `.claude/agents/security/security-review-specialist.md`
- **Upstream**: `https://github.com/anthropics/claude-code-security-review`
- **FP Rules**: `prompts/security-review/13-custom-fp-filtering.md`
- **Scan Extensions**: `prompts/security-review/12-custom-scan-instructions.md`
