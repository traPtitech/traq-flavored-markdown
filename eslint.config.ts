import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from '@typescript-eslint/eslint-plugin'
import prettier from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'

const recommendedTypescriptRules = tseslint.configs[
  'flat/recommended'
] as unknown as object[]

export default [
  {
    ignores: [
      '**/coverage',
      '**/dist',
      '**/node_modules',
      '**/target',
      '**/vendor',
      '**/testdata',
      '**/fixtures/**',
      '**/typescript/generated/**',
      '**/generated_*.go',
      'bun.lock'
    ]
  },
  js.configs.recommended,
  ...recommendedTypescriptRules,
  prettier,
  {
    plugins: {
      'unused-imports': unusedImports,
      '@stylistic/ts': stylistic
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-throw-literal': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@stylistic/ts/member-delimiter-style': [
        'error',
        {
          multiline: { delimiter: 'none' },
          singleline: { delimiter: 'semi' }
        }
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-empty-interface': 'error'
    }
  },
  {
    files: [
      'scripts/**/*.{mjs,ts}',
      'tools/corpus/scripts/**/*.{mjs,ts}',
      'packages/**/scripts/**/*.{js,mjs,ts,mts}'
    ],
    languageOptions: {
      globals: { ...globals.node, Bun: 'readonly' }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-unsafe-finally': 'off'
    }
  },
  {
    files: [
      'packages/**/typescript/tests/**/*.{mjs,ts}',
      'packages/**/examples/**/*.{mjs,mts,ts}'
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      'no-console': 'off',
      'no-unsafe-finally': 'off'
    }
  },
  {
    files: ['tools/corpus/viewer/**/*.ts', 'tools/corpus/viewer/**/*.tsx'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, CorpusDiff: 'readonly' }
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: {
      react: { version: '19.2.8' }
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-key': 'error',
      'react/no-unknown-property': 'error',
      'react/jsx-no-useless-fragment': 'warn',
      'react/jsx-boolean-value': 'error',
      'react/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never' }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  }
]
