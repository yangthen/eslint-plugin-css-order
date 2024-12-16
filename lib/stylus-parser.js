import postcssStyl from "postcss-styl";
import { CSSParser } from "./css-parser.js";
import { VCSSInlineComment } from "./ast.js";
import { StylusSelectorParser } from "./stylus-selector-parser.js";
/**
 * Stylus Parser
 */
export class StylusParser extends CSSParser {
  parseInternal(css) {
    return postcssStyl.parse(css);
  }

  createSelectorParser() {
    return new StylusSelectorParser(this.sourceCode, this.commentContainer);
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

  getRaw(
    node,
    keyName,
  ) {
    if (keyName === "between" || keyName === "before" || keyName === "after") {
      const stylus = super.getRaw(
        node,
        `stylus${keyName[0].toUpperCase()}${keyName.slice(1)}`,
      );
      if (stylus) {
        return stylus;
      }
    }
    const raw = super.getRaw(node, keyName);
    if (raw != null) {
      const stylus = raw.stylus;
      if (stylus != null) {
        return {
          raw: stylus,
          value: raw.value,
        };
      }
    }

    return raw;
  }
}