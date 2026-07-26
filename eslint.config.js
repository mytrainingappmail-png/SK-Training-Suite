import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude/worktrees can contain a stray checked-out worktree (left behind
  // by a background agent task) with its own tsconfig.json — without this,
  // ESLint's TS parser finds two candidate tsconfigRootDirs and fails to
  // parse every single file in the project, not just the ones inside it.
  globalIgnores(['dist', '.claude/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Destructuring-to-discard (const { x: _x, ...rest } = obj) is a
      // normal, deliberate pattern used across this codebase — don't flag
      // the intentionally-unused, underscore-prefixed half of it.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
])
