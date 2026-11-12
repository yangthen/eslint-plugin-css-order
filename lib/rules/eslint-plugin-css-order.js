import fs from 'node:fs'
import path from 'node:path'
import { canSwap, cascadeEffects } from '../css-cascade.js'
import defaultProperties from '../properties.js'
import { forEachContainer, nodeRange, visitStyles } from '../style-blocks.js'

const defaultRanks = createRanks(defaultProperties)
const ranksByDirectory = new Map()
const sameLine = /^[\t ]*$/
const nextLine = /^[\t ]*(?:\r\n|\r|\n)[\t ]*$/
const commentDirective = /^(?:stylelint-|eslint-|prettier-ignore\b|biome-ignore\b)/i

function lineIndent (css, index) {
  let start = index
  while (css[start - 1] === ' ' || css[start - 1] === '\t') start--
  return css[start - 1] === '\r' || css[start - 1] === '\n' ? css.slice(start, index) : null
}

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

function reportOrder (entries, { css, offset, lang }, context, sourceCode) {
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
    if (entry.start !== entry.declStart) {
      const indent = lineIndent(css, slot.start)
      // A leading comment on a shared line could become a trailing comment.
      if (indent === null || (lang === 'stylus' && indent !== lineIndent(css, entry.start))) return
    }

    if (i > first) replacement += css.slice(entries[i - 1].end, slot.start)
    replacement += css.slice(entry.start, entry.bodyEnd)
    if (slot.semicolon) replacement += ';'
    replacement += css.slice(entry.declEnd, entry.end)
  }

  const start = offset + entries[first].start
  const end = offset + entries[last].end
  const declStart = offset + entries[first].declStart

  context.report({
    loc: {
      start: sourceCode.getLocFromIndex(declStart),
      end: sourceCode.getLocFromIndex(declStart + entries[first].rawName.length)
    },
    messageId: 'cssSort',
    fix: fixer => fixer.replaceTextRange([start, end], replacement)
  })
}

function checkContainer (container, style, ranks, context, sourceCode) {
  const { css, lang } = style
  let entries = []
  let previousEnd = null
  let leadingStart = null
  let protectNext = false

  function reportEntries () {
    reportOrder(entries, style, context, sourceCode)
    entries = []
    leadingStart = null
  }

  for (const node of container.nodes) {
    const range = nodeRange(node, style)
    if (!range || (previousEnd !== null && range.start < previousEnd)) {
      reportEntries()
      previousEnd = null
      protectNext = false
      continue
    }

    const { start, end } = range
    const gap = previousEnd === null ? '' : css.slice(previousEnd, start)
    const followsOnSameLine = previousEnd !== null && sameLine.test(gap)
    const followsOnNextLine = nextLine.test(gap)
    previousEnd = end

    if (node.type === 'comment') {
      const previous = entries.at(-1)
      if (!commentDirective.test(node.text.trimStart())) {
        if (leadingStart !== null && (followsOnSameLine || followsOnNextLine)) continue
        if (previous && leadingStart === null && followsOnSameLine) {
          previous.end = end
          previous.lineComment ||= css.startsWith('//', start)
          continue
        }
        if (previous && leadingStart === null && followsOnNextLine) {
          leadingStart = start
          continue
        }
      }
      // Section headings, separated comments and directives stay in place.
      reportEntries()
      protectNext = true
      continue
    }

    const name = node.type === 'decl' && propertyName(node.prop)
    const detachedComment = leadingStart !== null && !followsOnSameLine && !followsOnNextLine
    if (protectNext || detachedComment || !name || name.startsWith('$') || !ranks.has(name)) {
      reportEntries()
      protectNext = false
      continue
    }

    const semicolon = css[end - 1] === ';' && !(lang === 'stylus' && node.omittedSemi)
    entries.push({
      name,
      rawName: node.prop,
      effects: cascadeEffects(name),
      rank: ranks.get(name),
      start: leadingStart ?? start,
      declStart: start,
      end,
      declEnd: end,
      bodyEnd: semicolon ? end - 1 : end,
      semicolon,
      lineComment: lang === 'stylus' && /\/\/[^\r\n]*$/.test(node.raws.value?.stylus ?? '')
    })
    leadingStart = null
  }
  reportEntries()
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'sort css styles',
      recommended: true,
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
    let ranks
    return visitStyles(context, (style, sourceCode) => {
      ranks ??= getRanks(context)
      forEachContainer(style.root, container => checkContainer(container, style, ranks, context, sourceCode))
    })
  }
}
