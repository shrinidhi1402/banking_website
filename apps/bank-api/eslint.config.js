import js from '@eslint/js'
import globals from 'globals'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  { ignores: ['node_modules/**'] },
  { files: ['**/*.js'], extends: [js.configs.recommended], languageOptions: { globals: globals.node } },
])
