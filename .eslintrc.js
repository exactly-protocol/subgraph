/** @type {import('eslint').Linter.Config} */
module.exports = {
  parserOptions: { project: ['tsconfig.json', 'tsconfig.dev.json'] },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:eslint-comments/recommended',
  ],
  rules: {
    'no-plusplus': 'off',
    'eslint-comments/no-unused-disable': 'error',
    'prefer-destructuring': 'off', // not supported
  },
  overrides: [
    {
      files: ['views/**/*.js', '**/.eslintrc.js'],
      extends: ['plugin:node/recommended'],
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      },
    },
  ],
};
