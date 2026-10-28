import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Functional style only: no classes in our own code.
      'no-restricted-syntax': [
        'error',
        { selector: 'ClassDeclaration', message: 'Use plain functions, not classes.' },
        { selector: 'ClassExpression', message: 'Use plain functions, not classes.' },
      ],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'scratch/**',
    'attendance-mobile.jsx',
    'landing-page-mobile (1).jsx',
  ]),
]);

export default eslintConfig;
