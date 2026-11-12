import fs from 'node:fs'
import path from 'node:path'
import { canSwap, cascadeEffects } from '../css-cascade.js'
import defaultProperties from '../properties.js'
import { forEachContainer, nodeRange, visitStyles } from '../style-blocks.js'

const defaultRanks = createRanks(defaultProperties)
const ranksByDirectory = new Map()
const sameLine = /^[\t ]*$/

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

function checkContainer (container, style, ranks, context, sourceCode) {
  const { css, offset, lang } = style
  let entries = []
  let previousEnd = null
  let protectNext = false

  function reportEntries () {
    reportOrder(entries, css, offset, context, sourceCode)
    entries = []
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
    const followsOnSameLine = previousEnd !== null &&
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
      effects: cascadeEffects(name),
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
    let ranks
    return visitStyles(context, (style, sourceCode) => {
      ranks ??= getRanks(context)
      forEachContainer(style.root, container => checkContainer(container, style, ranks, context, sourceCode))
    })
  }
}
