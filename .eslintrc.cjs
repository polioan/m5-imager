'use strict'

const path = require('node:path')

const { jsExtensions } = require('eslint-config-polioan/common/constants')

/**
 * @type {import('eslint').Linter.Config}
 */
const config = {
  extends: [
    'polioan/configurations/comments',
    'polioan/configurations/general',
    'polioan/configurations/generalTypes',
    'polioan/configurations/jsx',
    'polioan/configurations/regex',
    'polioan/configurations/cssModules',
    'polioan/configurations/react',
  ],
  env: {
    browser: true,
    commonjs: true,
    node: true,
    es2021: true,
  },
  settings: {},
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    project: path.join(__dirname, 'tsconfig.json'),
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [],
  rules: {
    'unicorn/filename-case': ['off'],
    'no-console': ['warn'],
  },
  overrides: [
    {
      files: ['*.cjs'],
      extends: ['polioan/configurations/commonJS'],
    },
    {
      files: jsExtensions,
      extends: ['polioan/configurations/javascriptOnly'],
    },
  ],
}

module.exports = config
