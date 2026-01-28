/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@ltip/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
