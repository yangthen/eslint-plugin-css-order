import { VCSSSelector } from './ast.js'

function isVCSSAtRule(
  node,
) {
  return node?.type === "VCSSAtRule";
}

/**
 * Checks whether the given node is VCSSTypeSelector
 * @param node node to check
 */
export function hasNodesSelector(
  node,
) {
  return (
    node != null &&
    (node.type === "VCSSSelector" || node.type === "VCSSSelectorPseudo")
  );
}

/**
 * Returns the normalized result of Pseudo params.
 */
export function normalizePseudoParams(
  pseudo,
  nodes,
) {
  const results = [];
  let buffer = [];
  for (const node of nodes) {
    if (node.type === "VCSSSelector") {
      if (buffer.length) {
        const startNode = buffer[0];
        const endNode = buffer[buffer.length - 1];
        const loc = {
          start: startNode.loc.start,
          end: endNode.loc.end,
        };
        results.push(
          new VCSSSelector(
            buffer[0],
            loc,
            startNode.start,
            endNode.end,
            {
              parent: pseudo,
              nodes: buffer,
            },
          ),
        );
        buffer = [];
      }
      results.push(node);
    } else {
      buffer.push(node);
    }
  }
  if (buffer.length) {
    const startNode = buffer[0];
    const endNode = buffer[buffer.length - 1];
    const loc = {
      start: startNode.loc.start,
      end: endNode.loc.end,
    };
    results.push(
      new VCSSSelector(buffer[0], loc, startNode.start, endNode.end, {
        parent: pseudo,
        nodes: buffer,
      }),
    );
    buffer = [];
  }
  return results;
}

/**
 * Checks whether the given node is ::v-deep or ::v-slotted or ::v-global pseudo
 * @param node node to check
 */
export function isVueSpecialPseudo(
  node,
) {
  return isVDeepPseudo(node) || isVSlottedPseudo(node) || isVGlobalPseudo(node);
}

/**
 * Checks whether the given node is ::v-deep pseudo for Vue.js v2
 * @param node node to check
 */
export function isVDeepPseudoV2(
  node,
) {
  if (isVDeepPseudo(node)) {
    return node.nodes.length === 0;
  }
  return false;
}

/**
 * Checks whether the given node is ::v-deep pseudo
 * @param node node to check
 */
export function isVDeepPseudo(
  node,
) {
  if (isPseudo(node)) {
    const val = node.value.trim();
    return val === "::v-deep" || val === ":deep";
  }
  return false;
}
/**
 * Checks whether the given node is ::v-slotted pseudo
 * @param node node to check
 */
export function isVSlottedPseudo(
  node,
) {
  if (isPseudo(node)) {
    const val = node.value.trim();
    return val === "::v-slotted" || val === ":slotted";
  }
  return false;
}
/**
 * Checks whether the given node is ::v-global pseudo
 * @param node node to check
 */
export function isVGlobalPseudo(
  node,
) {
  if (isPseudo(node)) {
    const val = node.value.trim();
    return val === "::v-global" || val === ":global";
  }
  return false;
}

/**
 * Checks whether the given pseudo node is empty arguments
 * @param node node to check
 */
export function isPseudoEmptyArguments(node) {
  return (
    node.nodes.length === 0 ||
    (node.nodes.length === 1 && node.nodes[0].nodes.length === 0)
  );
}

/**
 * Checks whether the given node is VCSSTypeSelector
 * @param node node to check
 */
export function isTypeSelector(
  node,
) {
  return node?.type === "VCSSTypeSelector";
}

/**
 * Checks whether the given node is VCSSIDSelector
 * @param node node to check
 */
export function isIDSelector(
  node,
) {
  return node?.type === "VCSSIDSelector";
}

/**
 * Checks whether the given node is VCSSSelectorNode
 * @param node node to check
 */
export function isClassSelector(
  node,
) {
  return node?.type === "VCSSClassSelector";
}

/**
 * Checks whether the given node is VCSSUniversalSelector
 * @param node node to check
 */
export function isUniversalSelector(
  node,
) {
  return node?.type === "VCSSUniversalSelector";
}

/**
 * Checks whether the given node is VCSSNestingSelector
 * @param node node to check
 */
export function isNestingSelector(
  node,
) {
  return node?.type === "VCSSNestingSelector";
}

/**
 * Checks whether the given node is VCSSNestingSelector
 * @param node node to check
 */
export function isPseudo(
  node,
) {
  return node?.type === "VCSSSelectorPseudo";
}

/**
 * Checks whether the given node is VCSSSelectorCombinator
 * @param node node to check
 */
export function isSelectorCombinator(
  node,
) {
  return node?.type === "VCSSSelectorCombinator";
}

/**
 * Checks whether the given node is descendant combinator
 * @param node node to check
 */
export function isDescendantCombinator(
  node,
) {
  return isSelectorCombinator(node) && node.value.trim() === "";
}

/**
 * Checks whether the given node is child combinator
 * @param node node to check
 */
export function isChildCombinator(
  node,
) {
  return isSelectorCombinator(node) && node.value.trim() === ">";
}

/**
 * Checks whether the given node is adjacent sibling combinator
 * @param node node to check
 */
export function isAdjacentSiblingCombinator(
  node,
) {
  return isSelectorCombinator(node) && node.value.trim() === "+";
}

/**
 * Checks whether the given node is general sibling combinator
 * @param node node to check
 */
export function isGeneralSiblingCombinator(
  node,
) {
  return isSelectorCombinator(node) && node.value.trim() === "~";
}

/**
 * Checks whether the given node is deep combinator
 * @param node node to check
 */
export function isDeepCombinator(
  node,
) {
  if (isSelectorCombinator(node)) {
    const val = node.value.trim();
    return val === ">>>" || val === "/deep/";
  }
  return false;
}

/**
 * Checks whether the given node is nesting atrule
 * @param node node to check
 */
export function isNestingAtRule(
  node
) {
  if (node == null) {
    return false;
  }
  return isVCSSAtRule(node) && node.name === "nest" && node.identifier === "@";
}

/**
 * Find nesting selectors
 * @param {Node[]} nodes selector nodes
 * @returns {IterableIterator<NestingInfo>} nesting selectors info
 */
export function* findNestingSelectors(
  nodes,
) {
  for (const node of nodes) {
    if (isNestingSelector(node)) {
      yield {
        nestingIndex: nodes.indexOf(node),
        node,
        nodes,
      };
    }
    if (hasNodesSelector(node)) {
      yield* findNestingSelectors(node.nodes);
    }
  }
}

/**
 * Find nesting selector
 */
export function findNestingSelector(
  nodes,
) {
  for (const nest of findNestingSelectors(nodes)) {
    return nest;
  }
  return null;
}