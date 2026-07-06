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
  prettier,
);
