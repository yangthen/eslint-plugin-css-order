import cssOrder from './rules/eslint-plugin-css-order.js'
import cssIndent from './rules/css-indent.js'
import cssDeclarationEmptyLine from './rules/css-declaration-empty-line.js'

export const rules = {
  'css-order': cssOrder,
  'css-indent': cssIndent,
  'css-declaration-empty-line': cssDeclarationEmptyLine
}

export default { rules }
