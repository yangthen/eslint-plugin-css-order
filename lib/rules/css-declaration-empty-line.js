import { forEachContainer, nodeRange, reportLayout, visitStyles } from '../style-blocks.js'

const gapPattern = /^([\t ]*)(\r\n|\n|\r)[\t \r\n]*$/

function checkEmptyLines (style, requireBlank) {
  const changes = []
  const { root, css } = style

  forEachContainer(root, container => {
    let previousEnd = null
    for (const node of container.nodes) {
      const range = nodeRange(node, style)
      if (!range || (previousEnd !== null && range.start < previousEnd)) {
        previousEnd = null
        continue
      }

      const { start, end } = range
      const gap = previousEnd === null ? null : css.slice(previousEnd, start)
      if (node.type === 'comment' && gap !== null && /^[\t ]*$/.test(gap)) {
        // A trailing comment belongs to the previous declaration.
        previousEnd = end
        continue
      }
      if (node.type !== 'decl') {
        previousEnd = null
        continue
      }

      const match = gap?.match(gapPattern)
      if (match) {
        const [, trailing, eol] = match
        const blankStart = previousEnd + trailing.length + eol.length
        const blankEnd = previousEnd + Math.max(gap.lastIndexOf('\r'), gap.lastIndexOf('\n')) + 1
        if (requireBlank !== (blankEnd > blankStart)) {
          changes.push({ start: blankStart, end: blankEnd, text: requireBlank ? eol : '' })
        }
      }
      previousEnd = end
    }
  })
  return changes
}

export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'enforce empty lines between declarations in Vue style blocks',
      url: 'https://github.com/yangthen/eslint-plugin-css-order/blob/main/docs/rules/css-declaration-empty-line.md'
    },
    fixable: 'whitespace',
    schema: [{ enum: ['always', 'never'] }],
    messages: {
      expected: '相邻声明之间应有空行。',
      unexpected: '相邻声明之间不应有空行。'
    }
  },

  create (context) {
    const requireBlank = context.options[0] === 'always'
    return visitStyles(context, (style, sourceCode) => {
      const messageId = requireBlank ? 'expected' : 'unexpected'
      reportLayout(context, sourceCode, style, checkEmptyLines(style, requireBlank), messageId)
    })
  }
}
