import postcssScss from "postcss-scss";
import { CSSParser } from "./css-parser.js";
import { VCSSInlineComment } from "./ast.js";
import { SCSSSelectorParser } from "./scss-selector-parser.js";

/**
 * SCSS Parser
 */
export class SCSSParser extends CSSParser {
  parseInternal(css) {
    return postcssScss.parse(css);
  }

  createSelectorParser() {
    return new SCSSSelectorParser(this.sourceCode, this.commentContainer);
  }

  /**
   * Convert comment Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {void}
   */
  convertCommentNode(
    node,
    loc,
    start,
    end,
    parent,
  ) {
    if (node.raws?.inline) {
      this.commentContainer.push(
        new VCSSInlineComment(node, node.text, loc, start, end, {
          parent,
        }),
      );
      return null;
    }
    return super.convertCommentNode(node, loc, start, end, parent);
  }

  getRaw (
    node,
    keyName,
  ) {
    const raw = super.getRaw(node, keyName);
    if (raw != null) {
      const scss = raw.scss;
      if (scss != null) {
        return {
          raw: scss,
          value: raw.value,
        };
      }
    }

    return raw;
  }
}