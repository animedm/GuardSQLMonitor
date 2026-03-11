module.exports = {
  root: true,
  env: { node: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
}
