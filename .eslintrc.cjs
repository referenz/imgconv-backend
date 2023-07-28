module.exports = {
  root: true,
  env: {
    es2023: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    //"plugin:@typescript-eslint/recommended-type-checked",
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:prettier/recommended',
  ],
  rules: {
    '@typescript-eslint/naming-convention': 1,
    'prettier/prettier': 1,
  },
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
};
