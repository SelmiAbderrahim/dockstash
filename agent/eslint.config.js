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
      // Argv-only spawn (surface #6). Ban `spawn(..., { shell: true })` on
      // the daemon so the cross-copy parity check has one edit-time
      // enforcement on both sides. See
      // .claude/rules/argv-only-spawn-and-ssrf.md.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='spawn'] ObjectExpression > Property[key.name='shell'][value.value=true]",
          message:
            'argv-only spawn: never `shell: true`. Pass an argv array and set `shell: false`.',
        },
      ],
      // `exec` runs a shell command string — banned on the daemon side too.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:child_process',
              importNames: ['exec', 'execSync', 'execFile', 'execFileSync'],
              message:
                'exec runs a shell command string — use spawn(argv[]) instead.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
