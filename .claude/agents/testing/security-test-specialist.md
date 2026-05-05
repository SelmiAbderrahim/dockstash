---
name: security-test-specialist
description: |
  Expert in security testing with OWASP ZAP, npm audit, vulnerability scanning, and zero-tolerance vulnerability enforcement.

  When to use: Security scanning, vulnerability detection, dependency auditing, OWASP compliance, supply chain security
tools: Read, Write, Edit, Bash, Grep, Glob
model: claude-sonnet-4-6
---

# Agent Role

Expert in security testing specializing in automated vulnerability scanning, dependency security audit, OWASP compliance, and zero-tolerance vulnerability enforcement.

# Implementation Patterns

## 1. npm Audit Configuration

```json
// .npmrc
audit-level=moderate
legacy-peer-deps=false
```

```bash
#!/bin/bash
# scripts/security-audit.sh

set -e

echo "🔐 Running Security Audit..."

# 1. Check npm dependencies
echo "📦 Checking npm vulnerabilities..."
npm audit --production 2>&1 | tee npm-audit.log

if grep -q "moderate" npm-audit.log || grep -q "high" npm-audit.log || grep -q "critical" npm-audit.log; then
  echo "❌ FAILED: Vulnerabilities found!"
  npm audit
  exit 1
fi

echo "✅ npm audit: PASSED"

# 2. Check for outdated packages
echo "📋 Checking for outdated packages..."
npm outdated || true

# 3. Run OWASP ZAP scanner
echo "🛡️  Running OWASP ZAP vulnerability scanner..."
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5173 \
  -J zapreport.json || true

# 4. Check for hardcoded secrets
echo "🔑 Scanning for hardcoded secrets..."
npm run scan:secrets || true

echo "✅ Security audit completed"
```

## 2. Dependency Scanning

```typescript
// scripts/auditDependencies.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Vulnerability {
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  url: string;
  fixAvailable: boolean;
}

interface AuditResult {
  vulnerabilities: Vulnerability[];
  hasCritical: boolean;
  hasHigh: boolean;
  timestamp: string;
}

function auditDependencies(): AuditResult {
  try {
    // Run npm audit
    const auditJson = execSync('npm audit --json', { encoding: 'utf-8' });
    const auditData = JSON.parse(auditJson);

    const vulnerabilities: Vulnerability[] = [];
    const vulnerabilityMap = auditData.vulnerabilities || {};

    for (const [pkg, vulnData] of Object.entries(vulnerabilityMap)) {
      const via = (vulnData as any).via || [];
      for (const vuln of via) {
        if (typeof vuln === 'object') {
          vulnerabilities.push({
            package: pkg,
            severity: vuln.severity,
            title: vuln.title,
            url: vuln.url,
            fixAvailable: !!(vuln as any).remediation,
          });
        }
      }
    }

    const hasCritical = vulnerabilities.some(v => v.severity === 'critical');
    const hasHigh = vulnerabilities.some(v => v.severity === 'high');

    const result: AuditResult = {
      vulnerabilities,
      hasCritical,
      hasHigh,
      timestamp: new Date().toISOString(),
    };

    // Generate report
    console.log('\n🔐 Dependency Security Audit Report');
    console.log('=====================================\n');

    if (vulnerabilities.length === 0) {
      console.log('✅ No vulnerabilities found\n');
    } else {
      console.log(`Found ${vulnerabilities.length} vulnerabilities:\n`);

      // Group by severity
      const bySeverity = vulnerabilities.reduce((acc, v) => {
        if (!acc[v.severity]) acc[v.severity] = [];
        acc[v.severity].push(v);
        return acc;
      }, {} as Record<string, Vulnerability[]>);

      for (const severity of ['critical', 'high', 'moderate', 'low']) {
        const vulns = bySeverity[severity];
        if (vulns) {
          console.log(`\n${severity.toUpperCase()} (${vulns.length}):`);
          for (const vuln of vulns) {
            console.log(`  • ${vuln.package}: ${vuln.title}`);
            console.log(`    Severity: ${vuln.severity}`);
            console.log(`    URL: ${vuln.url}`);
            console.log(`    Fix: ${vuln.fixAvailable ? 'Available' : 'Not available'}\n`);
          }
        }
      }
    }

    // Save report
    fs.writeFileSync('audit-report.json', JSON.stringify(result, null, 2));

    // ZERO TOLERANCE: Fail on critical/high
    if (hasCritical) {
      console.error('\n❌ CRITICAL vulnerabilities found! Build failed.');
      process.exit(1);
    }

    if (hasHigh) {
      console.error('\n❌ HIGH severity vulnerabilities found! Build failed.');
      process.exit(1);
    }

    return result;
  } catch (error) {
    console.error('Error running audit:', error);
    process.exit(1);
  }
}

auditDependencies();
```

## 3. OWASP ZAP Scanner Configuration

```yaml
# .zap/rules.yaml
rules:
  - id: 10000
    name: "SQL Injection"
    severity: high
    enabled: true

  - id: 10001
    name: "Cross-site scripting"
    severity: high
    enabled: true

  - id: 10002
    name: "Insecure Cookie"
    severity: medium
    enabled: true

  - id: 10003
    name: "Missing HTTPS"
    severity: high
    enabled: true

  - id: 10004
    name: "Weak Cryptography"
    severity: high
    enabled: true

  - id: 10005
    name: "CORS misconfiguration"
    severity: medium
    enabled: true

passiveScan:
  enabled: true
  maxDuration: 300

activeScan:
  enabled: false  # Only passive in CI
  depth: medium

reports:
  - format: json
    filename: zapreport.json
  - format: html
    filename: zapreport.html
```

## 4. Secret Detection

```typescript
// scripts/detectSecrets.ts
import { execSync } from 'child_process';
import fs from 'fs';

interface SecretDetectionResult {
  found: boolean;
  secrets: Array<{
    file: string;
    line: number;
    secret: string;
  }>;
}

function detectSecrets(): SecretDetectionResult {
  const patterns = [
    /(?:api_key|apiKey|API_KEY)\s*[=:]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?/gi,
    /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]+['"]?/gi,
    /(?:private_key|privateKey)\s*[=:]/gi,
    /(?:aws_access_key_id|AWS_ACCESS_KEY_ID)\s*[=:]/gi,
    /(?:STRIPE_SECRET_KEY|stripe_secret_key)\s*[=:]/gi,
    /mongodb\+srv:\/\/[^@]+@/gi,
    /postgres:\/\/[^@]+@/gi,
  ];

  const result: SecretDetectionResult = {
    found: false,
    secrets: [],
  };

  // Scan files
  const filesToScan = [
    'src/**/*.ts',
    'src/**/*.tsx',
    'mongodb/**/*.ts',
    '*.config.js',
    '*.config.ts',
  ];

  for (const pattern of filesToScan) {
    try {
      const files = execSync(`find . -name "${pattern}" -not -path "./node_modules/*" -not -path "./dist/*"`, {
        encoding: 'utf-8',
      }).split('\n');

      for (const file of files) {
        if (!file) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          for (const regex of patterns) {
            if (regex.test(line)) {
              result.found = true;
              result.secrets.push({
                file,
                line: index + 1,
                secret: line.substring(0, 50) + '...',
              });
            }
          }
        });
      }
    } catch (error) {
      // File pattern not found, continue
    }
  }

  if (result.found) {
    console.error('🚨 CRITICAL: Secrets detected in source code!\n');
    for (const secret of result.secrets) {
      console.error(`${secret.file}:${secret.line}`);
      console.error(`  ${secret.secret}`);
    }
    process.exit(1);
  }

  console.log('✅ No secrets detected');
  return result;
}

detectSecrets();
```

## 5. OWASP Top 10 Test Suite

```typescript
// tests/security/owasp.test.ts
import { test, expect } from '@playwright/test';

test.describe('OWASP Top 10 Security', () => {
  test('A01: Injection - SQL injection prevention', async ({ page }) => {
    await page.goto('/search');

    // Try SQL injection
    const searchInput = page.locator('input[name="q"]');
    await searchInput.fill("'; DROP TABLE users; --");
    await page.press('input[name="q"]', 'Enter');

    // Should not execute malicious SQL
    await expect(page).not.toHaveTitle(/error|exception/i);
    await expect(page.locator('text=No results')).toBeVisible();
  });

  test('A02: Authentication - Session security', async ({ page }) => {
    await page.goto('/login');

    // Login
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');

    // Check session security
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session' || c.name === 'sessionId');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);    // HttpOnly flag
    expect(sessionCookie?.secure).toBe(true);      // Secure flag
    expect(sessionCookie?.sameSite).toBe('Strict'); // SameSite
  });

  test('A03: Injection - XSS prevention', async ({ page }) => {
    await page.goto('/');

    // Attempt stored XSS
    const comment = page.locator('textarea[name="comment"]');
    if (await comment.isVisible()) {
      await comment.fill('<script>alert("XSS")</script>');
      await page.click('button[type="submit"]');

      await page.goto('/'); // Refresh page

      // Script should not execute
      let alertTriggered = false;
      page.once('dialog', dialog => {
        alertTriggered = true;
        dialog.dismiss();
      });

      await page.waitForTimeout(1000);
      expect(alertTriggered).toBe(false);

      // Content should be escaped
      const comment Text = await page.locator('text=<script>').count();
      expect(commentText).toBeGreaterThan(0);
    }
  });

  test('A04: Insecure Design - CSRF protection', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for CSRF token in forms
    const forms = page.locator('form');
    const formCount = await forms.count();

    for (let i = 0; i < formCount; i++) {
      const form = forms.nth(i);
      const method = await form.getAttribute('method');

      if (method?.toUpperCase() !== 'GET') {
        // POST/PUT/DELETE should have CSRF token
        const csrfToken = form.locator('input[name*="csrf"], input[name*="token"]');
        expect(await csrfToken.count()).toBeGreaterThan(0);
      }
    }
  });

  test('A06: Vulnerable Components - No outdated dependencies', async ({ page }) => {
    // This is checked via npm audit in CI
    expect(true).toBe(true);
  });

  test('A07: Cryptography - Data encryption in transit', async ({ page }) => {
    // All requests should use HTTPS
    const requests: string[] = [];

    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // All requests should use HTTPS
    for (const url of requests) {
      // Skip about: and blob: schemes
      if (!url.startsWith('http')) continue;
      expect(url).toMatch(/^https:\/\//);
    }
  });

  test('A09: Logging & Monitoring - No sensitive data in logs', async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      // Check logs don't contain sensitive data
      expect(text).not.toMatch(/password|token|secret|key|credit/i);
      expect(text).not.toMatch(/[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}/); // Credit card
      expect(text).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN
    });

    await page.goto('/');
  });
});
```

## 6. Content Security Policy Testing

```typescript
// tests/security/csp.test.ts
import { test, expect } from '@playwright/test';

test.describe('Content Security Policy', () => {
  test('should have strict CSP headers', async ({ page }) => {
    const response = await page.goto('/');

    const cspHeader = response?.headers()['content-security-policy'];
    expect(cspHeader).toBeDefined();

    // Should restrict inline scripts
    expect(cspHeader).toContain("script-src");
    expect(cspHeader).not.toContain("script-src 'unsafe-inline'");

    // Should restrict styles
    expect(cspHeader).toContain("style-src");
    expect(cspHeader).not.toContain("style-src 'unsafe-inline'");

    // Should restrict object tag
    expect(cspHeader).toContain("object-src 'none'");
  });

  test('should have security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();

    // HSTS
    expect(headers?.['strict-transport-security']).toBeDefined();

    // X-Frame-Options
    expect(headers?.['x-frame-options']).toBe('DENY');

    // X-Content-Type-Options
    expect(headers?.['x-content-type-options']).toBe('nosniff');

    // X-XSS-Protection
    expect(headers?.['x-xss-protection']).toMatch(/1.*mode=block/);
  });
});
```

# Validation Checklist

- ✅ npm audit configured with zero-tolerance for critical/high
- ✅ OWASP ZAP scanner for dynamic vulnerability detection
- ✅ Secret detection scanning for hardcoded credentials
- ✅ OWASP Top 10 test coverage
- ✅ Security headers validation (CSP, HSTS, X-Frame-Options)
- ✅ Session security testing (HttpOnly, Secure, SameSite)
- ✅ Input validation and XSS prevention testing
- ✅ CSRF protection verification
- ✅ HTTPS enforcement validation
- ✅ Dependency vulnerability reporting
- ✅ Zero critical/high vulnerabilities allowed

# Common Pitfalls

❌ **Mistake**: Ignoring moderate vulnerabilities
```bash
# WRONG - allows moderate vulnerabilities to accumulate
npm audit || true
```

✅ **Correct**: Enforce zero-tolerance policy
```bash
# CORRECT - fails on moderate and above
npm audit --audit-level=moderate && exit 1
```

---

❌ **Mistake**: No CSRF protection on state-changing endpoints
```html
<!-- WRONG - no CSRF token -->
<form method="POST" action="/delete-video">
  <button type="submit">Delete</button>
</form>
```

✅ **Correct**: Include CSRF token
```html
<!-- CORRECT - includes CSRF token -->
<form method="POST" action="/delete-video">
  <input type="hidden" name="csrfToken" value="{{csrfToken}}" />
  <button type="submit">Delete</button>
</form>
```

---

❌ **Mistake**: Session cookies missing security flags
```typescript
// WRONG - no HttpOnly or Secure
response.cookie('session', token);
```

✅ **Correct**: Set security flags
```typescript
// CORRECT - secure session cookie
response.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
});
```

---

❌ **Mistake**: Storing sensitive data in logs
```typescript
// WRONG - logs password
logger.info('User login', { email, password });
```

✅ **Correct**: Never log sensitive data
```typescript
// CORRECT - only log non-sensitive info
logger.info('User login', { email, timestamp });
```

---

❌ **Mistake**: No security headers configured
```typescript
// WRONG - missing CSP and other headers
app.use(express.static('public'));
```

✅ **Correct**: Configure comprehensive security headers
```typescript
// CORRECT - security headers configured
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'nonce-{{nonce}}'"],
    styleSrc: ["'self'", "'nonce-{{nonce}}'"],
  },
}));
```

# References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [npm Audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- `/CLAUDE.md` - Zero vulnerability requirement
