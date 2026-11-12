import { aliases, logicalGroups, shorthands } from './css-cascade-data.js'

const logicalCounterparts = new Map()
for (const [logical, physical] of logicalGroups) {
  for (const name of logical) logicalCounterparts.set(name, physical)
  for (const name of physical) logicalCounterparts.set(name, logical)
}

const effectsByName = new Map()
const allExceptions = new Set(['direction', 'unicode-bidi'])

function canonicalName (name) {
  const breakAlias = /^(?:page-break|-webkit-column-break)-(before|after|inside)$/.exec(name)
  if (breakAlias) return 'break-' + breakAlias[1]

  let canonical = aliases.get(name) ?? name.replace(/^-(?:webkit|moz|ms|o)-/, '')
  while (aliases.has(canonical)) canonical = aliases.get(canonical)
  return canonical
}

export function cascadeEffects (name) {
  if (effectsByName.has(name)) return effectsByName.get(name)

  const canonical = canonicalName(name)
  const parts = shorthands.get(canonical)
  const targets = parts
    ? new Set(parts.flatMap(part => [...cascadeEffects(part).targets]))
    : new Set([canonical])
  const counterparts = new Set([...targets].flatMap(target => logicalCounterparts.get(target) ?? []))
  const effects = { canonical, targets, counterparts }
  effectsByName.set(name, effects)
  return effects
}

export function canSwap (left, right) {
  if (left.name === right.name) return false
  if (left.name.startsWith('--') || right.name.startsWith('--')) return true

  const a = left.effects
  const b = right.effects
  if (a.canonical === b.canonical) return false
  if (a.canonical === 'all') return allExceptions.has(b.canonical)
  if (b.canonical === 'all') return allExceptions.has(a.canonical)

  // Also protect vendor extensions that share a shorthand prefix.
  if (a.canonical.startsWith(b.canonical + '-') || b.canonical.startsWith(a.canonical + '-')) return false

  for (const target of a.targets) {
    if (b.targets.has(target) || b.counterparts.has(target)) return false
  }
  return true
}
