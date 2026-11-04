import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
      // React Compiler eslint (hooks 7) — widespread on existing admin hydration
      // patterns; keep visible as warnings until packs are migrated systematically.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    // SF-141: Core hosts extension points; modules contribute via manifests + generated registry.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules', '@/modules/*', '@/modules/**'],
              message:
                'Core must not import @/modules/**. Use @/generated/* (module-registry) or public Core ports.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['.next/', 'src/payload-types.ts'],
  },
]

export default eslintConfig
