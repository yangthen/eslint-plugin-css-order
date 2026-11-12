import { getSourceCode } from 'eslint-compat-utils'
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import scss from 'postcss-scss'
import stylus from 'postcss-styl'
import defaultProperties from '../properties.js'

const parsers = new Map([
  ['css', postcss.parse],
  ['scss', scss.parse],
  ['stylus', stylus.parse]
])

const defaultRanks = createRanks(defaultProperties)
const ranksByDirectory = new Map()
const sameLine = /^[\t ]*$/

// Logical and physical properties can target the same side or axis.
const logicalPropertyPairs = [
  [/^inset-(?:block|inline)(?:-|$)/, /^(?:top|right|bottom|left)$/],
  [/^(?:min-|max-)?(?:inline-size|block-size)$/, /^(?:min-|max-)?(?:width|height)$/],
  ...['margin', 'padding', 'scroll-margin', 'scroll-padding', 'border'].map(name => [
    new RegExp('^' + name + '-(?:block|inline)(?:-|$)'),
    new RegExp('^' + name + '-(?:top|right|bottom|left)(?:-|$)')
  ]),
  [/^border-(?:start|end)-(?:start|end)-radius$/, /^border-(?:top|bottom)-(?:left|right)-radius$/],
  [/^contain-intrinsic-(?:inline-size|block-size)$/, /^contain-intrinsic-(?:width|height)$/],
  [/^overflow-(?:block|inline)$/, /^overflow-(?:x|y)$/],
  [/^overscroll-behavior-(?:block|inline)$/, /^overscroll-behavior-(?:x|y)$/]
]

const shorthandParts = new Map([
  ['columns', ['column-count', 'column-width']],
  ['contain-intrinsic-size', ['contain-intrinsic-width', 'contain-intrinsic-height', 'contain-intrinsic-inline-size', 'contain-intrinsic-block-size']],
  ['flex-flow', ['flex-direction', 'flex-wrap']],
  ['font', ['line-height']],
  ['gap', ['row-gap', 'column-gap']],
  ['grid-area', ['grid-row', 'grid-column']],
  ['inset', ['top', 'right', 'bottom', 'left']],
  ['line-clamp', ['max-lines', 'block-ellipsis', 'continue']],
  ['place-content', ['align-content', 'justify-content']],
  ['place-items', ['align-items', 'justify-items']],
  ['place-self', ['align-self', 'justify-self']],
  ['text-spacing', ['text-autospace']],
  ['vertical-align', ['baseline-source', 'alignment-baseline', 'baseline-shift']],
  ['white-space', ['text-wrap']]
])

const aliases = new Map([
  ['grid-gap', 'gap'],
  ['grid-row-gap', 'row-gap'],
  ['grid-column-gap', 'column-gap'],
  ['page-break-after', 'break-after'],
  ['page-break-before', 'break-before'],
  ['page-break-inside', 'break-inside'],
  ['word-wrap', 'overflow-wrap']
])

function propertyName (name) {
  return name.startsWith('--') ? name : name.toLowerCase()
}

function createRanks (properties) {
  const ranks = new Map()
  for (const name of properties) {
    const property = propertyName(name)
    if (!ranks.has(property)) {
      ranks.set(property, ranks.size)
    }
  }
  return ranks
}

function getRanks (context) {
  const configured = context.options[0]?.propertyGroups
  if (configured) return createRanks(configured)

  const cwd = context.cwd ?? context.getCwd()
  if (ranksByDirectory.has(cwd)) return ranksByDirectory.get(cwd)

  const configPath = path.join(cwd, 'css-order.config.json')
  let ranks = defaultRanks
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const properties = Array.isArray(config) ? config : config?.propertyGroups
    if (!Array.isArray(properties) || !properties.every(name => typeof name === 'string' && name.trim())) {
      throw new TypeError('Expected an array of property names')
    }
    ranks = createRanks(properties)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading css-order configuration at ' + configPath, error)
    }
  }
  ranksByDirectory.set(cwd, ranks)
  return ranks
}

function cascadeName (name) {
  const unprefixed = name.replace(/^-(?:webkit|moz|ms|o)-/, '')
  return aliases.get(unprefixed) ?? unprefixed
}

function includesProperty (shorthand, property) {
  if (/^border(?:-(?:block|inline))?-(?:color|style|width)$/.test(shorthand) &&
    /^border-(?:top|right|bottom|left|block|inline)(?:-|$)/.test(property)) return true
  if (shorthand === 'border-radius' && /^border-.+-radius$/.test(property)) return true

  return property.startsWith(shorthand + '-') ||
    shorthandParts.get(shorthand)?.some(part => property === part || property.startsWith(part + '-'))
}

function canSwap (left, right) {
  if (left.name === right.name) return false
  if (left.name.startsWith('--') || right.name.startsWith('--')) return true

  const a = left.cascadeName
  const b = right.cascadeName
  return a !== b && a !== 'all' && b !== 'all' &&
    !includesProperty(a, b) && !includesProperty(b, a) &&
    !logicalPropertyPairs.some(([logical, physical]) =>
      (logical.test(a) && physical.test(b)) || (physical.test(a) && logical.test(b)))
}

function reportOrder (entries, css, offset, context, sourceCode) {
  if (entries.length < 2) return

  const sorted = entries.slice()
  // Only swap adjacent declarations when their relative order cannot affect the cascade.
  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    let j = i
    while (j > 0 && entry.rank < sorted[j - 1].rank && canSwap(sorted[j - 1], entry)) {
      sorted[j] = sorted[j - 1]
      j--
    }
    sorted[j] = entry
  }

  const first = entries.findIndex((entry, index) => entry !== sorted[index])
  if (first === -1) return

  let last = entries.length - 1
  while (entries[last] === sorted[last]) last--

  let replacement = ''
  for (let i = first; i <= last; i++) {
    const slot = entries[i]
    const entry = sorted[i]
    // A line comment must not move in front of code on the same line.
    if (entry.lineComment && !/^[\t ]*(?:\r\n?|\n|$)/.test(css.slice(slot.end))) return

    if (i > first) replacement += css.slice(entries[i - 1].end, slot.start)
    replacement += css.slice(entry.start, entry.bodyEnd)
    if (slot.semicolon) replacement += ';'
    replacement += css.slice(entry.declEnd, entry.end)
  }

  const start = offset + entries[first].start
  const end = offset + entries[last].end
  const startLoc = sourceCode.getLocFromIndex(start)

  context.report({
    loc: {
      start: startLoc,
      end: sourceCode.getLocFromIndex(start + entries[first].rawName.length)
    },
    messageId: 'cssSort',
    fix: fixer => fixer.replaceTextRange([start, end], replacement)
  })
}

function checkContainer (container, css, offset, lang, ranks, context, sourceCode) {
  let entries = []
  let previousEnd = null
  let protectNext = false

  function reportEntries () {
    reportOrder(entries, css, offset, context, sourceCode)
    entries = []
  }

  for (const node of container.nodes) {
    const start = node.source?.start?.offset
    const rawEnd = node.source?.end?.offset
    // postcss-styl reports an inclusive end offset.
    const end = lang === 'stylus' ? rawEnd + 1 : rawEnd
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start || end > css.length ||
      (previousEnd !== null && start < previousEnd)) {
      reportEntries()
      previousEnd = null
      protectNext = false
      continue
    }

    const followsOnSameLine = previousEnd !== null && previousEnd <= start &&
      sameLine.test(css.slice(previousEnd, start))
    previousEnd = end

    if (node.type === 'comment') {
      if (followsOnSameLine) {
        const previous = entries.at(-1)
        if (previous) {
          previous.end = end
          previous.lineComment ||= css.startsWith('//', start)
        }
      } else {
        // Keep a standalone comment in place with the declaration it introduces.
        reportEntries()
        protectNext = true
      }
      continue
    }

    const name = node.type === 'decl' && propertyName(node.prop)
    if (protectNext || !name || name.startsWith('$') || !ranks.has(name)) {
      reportEntries()
      protectNext = false
      continue
    }

    const semicolon = css[end - 1] === ';' && !(lang === 'stylus' && node.omittedSemi)
    entries.push({
      name,
      rawName: node.prop,
      cascadeName: cascadeName(name),
      rank: ranks.get(name),
      start,
      end,
      declEnd: end,
      bodyEnd: semicolon ? end - 1 : end,
      semicolon,
      lineComment: lang === 'stylus' && /\/\/[^\r\n]*$/.test(node.raws.value?.stylus ?? '')
    })
  }
  reportEntries()
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'sort css styles',
      recommended: false,
      url: 'https://github.com/yangthen/eslint-plugin-css-order/blob/main/docs/rules/css-order.md'
    },
    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        propertyGroups: { type: 'array', items: { type: 'string', pattern: '\\S' } }
      },
      additionalProperties: false
    }],
    messages: {
      cssSort: 'css属性顺序错误'
    }
  },

  create (context) {
    const sourceCode = getSourceCode(context)
    const document = sourceCode.parserServices.getDocumentFragment?.() ??
      sourceCode.ast.templateBody?.parent
    const styles = document?.children.filter(node => node.type === 'VElement' && node.name === 'style')
    if (!styles?.length) return {}

    return {
      'Program:exit' () {
        const ranks = getRanks(context)
        for (const style of styles) {
          const { startTag, endTag } = style
          if (!endTag) continue

          const attributes = startTag.attributes.filter(attr => attr.type === 'VAttribute')
          if (attributes.some(attr => attr.key.name === 'src')) continue
          const lang = (attributes.find(attr => attr.key.name === 'lang')?.value?.value || 'css').toLowerCase()
          const parse = parsers.get(lang)
          if (!parse) continue

          let offset = startTag.range[1]
          if (/^[\uFEFF\uFFFE]/.test(sourceCode.text[offset] ?? '')) offset++
          const css = sourceCode.text.slice(offset, endTag.range[0])
          let root
          try {
            root = parse(css, { from: undefined })
          } catch (error) {
            if (error.name !== 'CssSyntaxError') throw error
            continue
          }

          const check = node => checkContainer(node, css, offset, lang, ranks, context, sourceCode)
          check(root)
          root.walk(node => {
            if (node.nodes) check(node)
          })
        }
      }
    }
  }
}
