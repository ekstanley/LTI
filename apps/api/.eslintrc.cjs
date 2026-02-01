/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@ltip/eslint-config/node'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
