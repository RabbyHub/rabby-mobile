const prettierConfig = require('./.prettierrc.js');

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    plugins: [
      // 'react-app',
      '@typescript-eslint',
      'prettier'
    ],
    extends: [
      // 'plugin:react-app/recommended',
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
      'prettier',
      'prettier/@typescript-eslint',
      'prettier/react',
      'plugin:prettier/recommended' // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    ignorePatterns: [
      '**/*/*.d.ts'
    ],
    rules: {
      'prettier/prettier': [
        /* warning */
        1,
        prettierConfig,
      ],
      'func-call-spacing': 0,
      'no-extra-parens': 0,
      'no-magic-numbers': 0,
      'no-unused-vars': 0,
      '@typescript-eslint/no-unused-vars': [
        'off', {
          'vars': 'all',
          'args': 'none',
          "ignoreRestSiblings": true,
          'varsIgnorePattern': "(React)"
        }
      ],
      semi: 0,
      'react/sort-comp': 0,
      'react/prop-types': 0,
      '@typescript-eslint/triple-slash-reference': 0,
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/explicit-function-return-type': 0,
      '@typescript-eslint/explicit-member-accessibility': 0,
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          // custom: {
          //   regex: '^I[A-Z]',
          //   match: true,
          // },
        },
      ],
      '@typescript-eslint/no-var-requires': 0,
      '@typescript-eslint/no-inferrable-types': 0,
      'jsx-control-statements/jsx-use-if-tag': 0,
      'jsx-a11y/anchor-is-valid': 0,
      '@typescript-eslint/camelcase': 0,
      '@typescript-eslint/no-empty-interface': 1,
      'ordered-imports': 0,
      'only-arrow-functions': 0,
      'prefer-const': 0,
      'member-ordering': 0,
      'member-access': 0,
      'max-classes-per-file': 0,
      'no-empty': 0,
      'no-console': 0,
      'object-literal-sort-keys': 0,
      'jsx-no-lambda': 0,
      'no-string-literal': 0,
      'callable-types': 0,
      'no-var-requires': 0,
      'typedef-whitespace': 0,
      'no-eval': 2,
      'prefer-object-spread': 1,
      '@typescript-eslint/indent': [
        2,
        2,
        {
          SwitchCase: 1,
          flatTernaryExpressions: false,
        },
      ],
      'no-duplicate-imports': 2,
      'new-parens': 2,
      'no-multiple-empty-lines': [
        2,
        {
          max: 2,
        },
      ],
      'no-irregular-whitespace': 2,
      'curly': 0,
      'space-before-function-paren': 0,
      'no-unsafe-finally': 2,
      'no-submodule-imports': 0,
      'no-implicit-dependencies': 0,
      'prefer-conditional-expression': 0,
      'no-debugger': 2,
      'no-multi-spaces': 2,
      'use-isnan': 2,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      'no-async-promise-executor': 1,
    }
  };
