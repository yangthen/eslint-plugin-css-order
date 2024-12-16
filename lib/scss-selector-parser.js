import selectorParser from "postcss-selector-parser";
import { VCSSInlineComment } from "./ast.js";
import { CSSSelectorParser } from "./css-selector-parser.js";
import { replaceSelector, restoreReplacedSelector } from "./replace-utils.js";

export class SCSSSelectorParser extends CSSSelectorParser {
  parseInternal(selector) {
    const replaceSelectorContext = replaceSelector(
      selector,
      [
        {
          regexp: /#\{[\s\S]+?\}/gu, // interpolation
          replace: (_res, random) => `_${random}_`,
        },
      ],
      [
        {
          regexp: /\/\/[^\n\r\u2028\u2029]*/gu, // inline comment
          replace: (_res, random) => `/*${random}*/`,
        },
      ],
    );

    const result = selectorParser().astSync(
      replaceSelectorContext.cssSelector,
    );
    if (!replaceSelectorContext.hasReplace()) {
      return result;
    }
    return restoreReplacedSelector(
      result,
      replaceSelectorContext,
    );
  }

  parseCommentsInternal(selector) {
    return this.parseInternal(selector);
  }

  /**
   * Convert comment Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {null}
   */
  convertCommentNode(
    node,
    loc,
    start,
    end,
    parent,
  ) {
    if (node.value.startsWith("//")) {
      // inline comment
      const text = node.value.replace(/^\s*\/\//u, "");
      this.commentContainer.push(
        new VCSSInlineComment(node, text, loc, start, end, {
          parent,
        }),
      );
      return null;
    }
    return super.convertCommentNode(node, loc, start, end, parent);
  }
}