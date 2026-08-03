import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', '**/coverage/**', '*.cjs'],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    // Cross-account IDOR isolation — surface #2 in
    // prompts/dockstash-security/02-cross-account-idor-isolation-opus-4.7.md
    // Controllers MUST route resource loads through owner-scoped helpers
    // (loadOwnedProject / loadOwnedSchedule / loadOwnedAgent / findOne with
    // owner filter). Bare `Model.findById(req.params...)` or
    // `Model.findOne({ _id: req.params... })` in a controller is the exact
    // shape that ships an IDOR — the query returns the row before ownership
    // is checked. Escape hatch: an inline `// idor-safe: <reason>` comment
    // above the call, audited in code review.
    files: ['src/modules/**/*.controller.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Ban `X.findById(req.params.*)` in controllers.
          selector:
            "CallExpression[callee.property.name='findById'][arguments.0.type='MemberExpression'][arguments.0.object.property.name='params']",
          message:
            'IDOR: use loadOwnedX / findOne({ _id, owner }) instead of findById(req.params.*). See .claude/rules/owner-scoped-queries.md.',
        },
      ],
    },
  },
  {
    // Command execution / SSRF / input validation — surface #6 in
    // prompts/dockstash-security/06-command-execution-ssrf-input-validation-opus-4.7.md
    // Argv-only spawn everywhere; no shell strings; no host-key auto-accept.
    // Meta-test at `shared/middleware/command-execution-meta.test.ts` covers
    // the source-tree greps; this rule catches the shape at edit time.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // `spawn(..., { shell: true })` re-enables shell metacharacter
          // interpretation — the exact shape command-injection rides in on.
          selector:
            "CallExpression[callee.name='spawn'] ObjectExpression > Property[key.name='shell'][value.value=true]",
          message:
            'argv-only spawn: never `shell: true`. Pass an argv array and set `shell: false`. See .claude/rules/argv-only-spawn-and-ssrf.md.',
        },
      ],
    },
  },
  {
    // `child_process.exec` runs its command string through /bin/sh — same
    // shell-interpretation surface. `spawn(argv[])` is the only allowed form
    // in backup/agent code.
    files: ['src/modules/backups/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:child_process',
              importNames: ['exec', 'execSync', 'execFile', 'execFileSync'],
              message:
                'exec runs a shell command string — use spawn(argv[]) instead. See .claude/rules/argv-only-spawn-and-ssrf.md.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
