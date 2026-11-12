import { forEachContainer, nodeRange, reportLayout, visitStyles } from '../style-blocks.js'

function checkIndent (style, unit, baseIndent) {
  const { css, root } = style
  const depths = new Map([[root, baseIndent]])
  const changes = []

  function check (index, depth) {
    let start = index
    while (css[start - 1] === ' ' || css[start - 1] === '\t') start--
    // The first fragment line starts on the same line as the opening tag.
    if (css[start - 1] !== '\r' && css[start - 1] !== '\n') return

    const actual = css.slice(start, index)
    const text = unit.repeat(depth)
    if (actual !== text) {
      changes.push({ start, end: index, text, data: { expected: JSON.stringify(text) } })
    }
  }

  forEachContainer(root, container => {
    const depth = depths.get(container)
    for (const node of container.nodes) {
      if (node.nodes) depths.set(node, depth + 1)
      const range = nodeRange(node, style)
      if (!range) continue

      check(range.start, depth)
      if (node.nodes && !node.pythonic && css[range.end - 1] === '}') {
        check(range.end - 1, depth)
      }
    }
  })
  return changes
}

export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'enforce indentation in Vue style blocks',
      url: 'https://github.com/yangthen/eslint-plugin-css-order/blob/main/docs/rules/css-indent.md'
    },
    fixable: 'whitespace',
    schema: [{
      type: 'object',
      properties: {
        indent: { anyOf: [{ type: 'integer', minimum: 1 }, { enum: ['tab'] }] },
        baseIndent: { type: 'integer', minimum: 0 }
      },
      additionalProperties: false
    }],
    messages: {
      indent: '样式缩进应为 {{expected}}。'
    }
  },

  create (context) {
    const { indent = 2, baseIndent = 0 } = context.options[0] ?? {}
    const unit = indent === 'tab' ? '\t' : ' '.repeat(indent)
    return visitStyles(context, (style, sourceCode) => {
      reportLayout(context, sourceCode, style, checkIndent(style, unit, baseIndent), 'indent')
    })
  }
}
