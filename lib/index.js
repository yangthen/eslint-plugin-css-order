import { createRequire } from 'node:module'
import cssOrder from './rules/eslint-plugin-css-order.js'
import cssIndent from './rules/css-indent.js'
import cssDeclarationEmptyLine from './rules/css-declaration-empty-line.js'

export const rules = {
  'css-order': cssOrder,
  'css-indent': cssIndent,
  'css-declaration-empty-line': cssDeclarationEmptyLine
}

const { name, version } = createRequire(import.meta.url)('../package.json')
export const configs = {}
const plugin = { meta: { name, version }, rules, configs }

configs.recommended = {
  name: 'css-order/recommended',
  files: ['**/*.vue'],
  plugins: { 'css-order': plugin },
  rules: {
    'css-order/css-order': 'warn',
    'css-order/css-indent': 'warn'
  }
}

export default plugin
