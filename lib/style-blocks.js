import { getSourceCode } from 'eslint-compat-utils'
import postcss from 'postcss'
import scss from 'postcss-scss'
import stylus from 'postcss-styl'

const parsers = new Map([
  ['css', postcss.parse],
  ['scss', scss.parse],
  ['stylus', stylus.parse]
])
const stylesByAST = new WeakMap()

function parseStyle (css, lang) {
  try {
    return parsers.get(lang)(css, { from: undefined })
  } catch (error) {
    if (error.name !== 'CssSyntaxError') throw error
    return null
  }
}

function getStyles (sourceCode) {
  if (stylesByAST.has(sourceCode.ast)) return stylesByAST.get(sourceCode.ast)

  const document = sourceCode.parserServices.getDocumentFragment?.() ??
    sourceCode.ast.templateBody?.parent
  const styles = []
  for (const node of document?.children ?? []) {
    if (node.type !== 'VElement' || node.name !== 'style' || !node.endTag) continue

    const attributes = node.startTag.attributes.filter(attr => attr.type === 'VAttribute')
    if (attributes.some(attr => attr.key.name === 'src')) continue
    const lang = (attributes.find(attr => attr.key.name === 'lang')?.value?.value || 'css').toLowerCase()
    if (!parsers.has(lang)) continue

    let offset = node.startTag.range[1]
    if (/^[\uFEFF\uFFFE]/.test(sourceCode.text[offset] ?? '')) offset++
    const css = sourceCode.text.slice(offset, node.endTag.range[0])
    const root = parseStyle(css, lang)
    if (root) styles.push({ css, lang, offset, root })
  }
  stylesByAST.set(sourceCode.ast, styles)
  return styles
}

export function visitStyles (context, check) {
  const sourceCode = getSourceCode(context)
  return {
    'Program:exit' () {
      for (const style of getStyles(sourceCode)) check(style, sourceCode)
    }
  }
}

export function forEachContainer (root, check) {
  check(root)
  root.walk(node => {
    if (node.nodes) check(node)
  })
}

export function nodeRange (node, style) {
  const start = node.source?.start?.offset
  const rawEnd = node.source?.end?.offset
  // postcss-styl uses inclusive end offsets.
  const end = style.lang === 'stylus' ? rawEnd + 1 : rawEnd
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > style.css.length) {
    return null
  }
  return { start, end }
}

const nonSyntaxFields = new Set(['source', 'raws', 'parent', 'nodes', 'indexes', 'lastEach', 'proxyCache'])

function syntaxTree (node) {
  const fields = Object.keys(node).filter(key => !nonSyntaxFields.has(key)).sort()
  return [fields.map(key => [key, node[key]]), node.nodes?.map(syntaxTree)]
}

export function reportLayout (context, sourceCode, style, changes, messageId) {
  const { css, lang, offset, root } = style
  const fixChange = (fixer, { start, end, text }) =>
    fixer.replaceTextRange([offset + start, offset + end], text)
  let stylusFix

  if (lang === 'stylus' && changes.length) {
    // Indentation is significant in Stylus. Validate the whole set of edits together.
    changes.sort((a, b) => a.start - b.start)
    let output = ''
    let previousEnd = 0
    for (const { start, end, text } of changes) {
      output += css.slice(previousEnd, start) + text
      previousEnd = end
    }
    const parsed = parseStyle(output + css.slice(previousEnd), lang)
    if (parsed && JSON.stringify(syntaxTree(root)) === JSON.stringify(syntaxTree(parsed))) {
      stylusFix = fixer => changes.map(change => fixChange(fixer, change))
    }
  }

  for (const [index, change] of changes.entries()) {
    context.report({
      loc: {
        start: sourceCode.getLocFromIndex(offset + change.start),
        end: sourceCode.getLocFromIndex(offset + change.end)
      },
      messageId,
      data: change.data,
      fix: lang === 'stylus' ? (index === 0 ? stylusFix : undefined) : fixer => fixChange(fixer, change)
    })
  }
}
