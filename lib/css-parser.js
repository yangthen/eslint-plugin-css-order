import * as postcss from "postcss";
import postcssSafeParser from "postcss-safe-parser";
import { CSSSelectorParser } from "./css-selector-parser.js";
import { VCSSStyleSheet,
  VCSSStyleRule,
  VCSSDeclarationProperty,
  VCSSAtRule,
  VCSSComment,
  VCSSParsingError,
  VCSSUnknown
} from "./ast.js";

function isVCSSAtRule(
  node,
) {
  return node?.type === "VCSSAtRule";
}
/**
 * Checks whether the given node is VCSSStyleRule
 * @param node node to check
 */
function isVCSSStyleRule(
  node
) {
  return node?.type === "VCSSStyleRule";
}
/**
 * Checks whether the given node is VCSSStyleSheet
 * @param node node to check
 */
function isVCSSStyleSheet(
  node
) {
  return node?.type === "VCSSStyleSheet";
}

function isVCSSContainerNode(
  node,
) {
  return (
    isVCSSAtRule(node) ||
    isVCSSStyleRule(node) ||
    isVCSSStyleSheet(node) ||
    node?.type === "VCSSUnknown"
  );
}

function isDefined (item) {
  return item !== null && item !== undefined;
}

function isPostCSSContainer(
  node,
) {
  return node.nodes != null;
}

/**
 * CSS Parser
 */
export class CSSParser {
  /**
   * constructor.
   * @param {SourceCode} sourceCode the SourceCode object that you can use to work with the source that was passed to ESLint.
   */
  constructor(sourceCode, lang) {
    this.sourceCode = sourceCode;
    this._selectorParser = null
    this.commentContainer = [];
    this.anyErrors = [];
    this.lang = lang;
  }
                                                                                                                                                                                                                                
  /**
   * Parse the CSS.
   * @param {string} css the CSS to parse
   * @param {LineAndColumnData} offsetLocation start location of css.
   * @return {VCSSStyleSheet} parsed result
   */
  parse(css, offsetLocation) {
    const { sourceCode } = this;

    this.commentContainer = [];
    this._selectorParser = this.createSelectorParser();
    this.anyErrors = [];

    try {
      const postcssRoot = this.parseInternal(css);

      const rootNode = this._postcssNodeToASTNode(offsetLocation, postcssRoot);
      rootNode.comments = this.commentContainer;
      rootNode.errors.push(
        ...this.collectErrors(this.anyErrors, offsetLocation),
      );

      return rootNode;
    } catch (e) {
      const startIndex = sourceCode.getIndexFromLoc(offsetLocation);
      const endIndex = startIndex + css.length;
      const styleLoc = {
        start: offsetLocation,
        end: sourceCode.getLocFromIndex(endIndex),
      };
      return new VCSSStyleSheet(null, styleLoc, startIndex, endIndex, {
        errors: this.collectErrors([...this.anyErrors, e], offsetLocation),
        lang: this.lang,
      });
    }
  }

  addError(error) {
    this.anyErrors.push(error);
  }

  collectErrors(
    errors,
    offsetLocation,
  ) {
    const errorNodes = [];
    const duplicate = new Set();
    for (const error of errors) {
      const errorLoc =
        error.line != null && error.column != null
          ? getESLintLineAndColumnFromPostCSSPosition(offsetLocation, error)
          : offsetLocation;
      const message = error.reason || error.message;

      const key = `[${errorLoc.line}:${errorLoc.column}]: ${message}`;
      if (duplicate.has(key)) {
        continue;
      }
      duplicate.add(key);
      const errorIndex = this.sourceCode.getIndexFromLoc(errorLoc);
      errorNodes.push(
        new VCSSParsingError(
          null,
          {
            start: errorLoc,
            end: errorLoc,
          },
          errorIndex,
          errorIndex,
          {
            lang: this.lang,
            message,
          },
        ),
      );
    }
    return errorNodes;
  }

  get selectorParser() {
    return (
      this._selectorParser ||
      (this._selectorParser = this.createSelectorParser())
    );
  }

  /**
   * Convert PostCSS node to node that can be handled by ESLint.
   * @param {LineAndColumnData} offsetLocation start location of css.
   * @param {object} node the PostCSS node to convert
   * @param {Node?} parent parent node
   * @return {Node|null} converted node.
   */
  _postcssNodeToASTNode(
    offsetLocation,
    node,
    parent,
  ) {
    const { sourceCode } = this;
    const startLoc = getESLintLineAndColumnFromPostCSSNode(
      offsetLocation,
      node,
      "start",
    ) || { line: 0, column: 1 };
    const start = sourceCode.getIndexFromLoc(startLoc);
    const endLoc =
      getESLintLineAndColumnFromPostCSSNode(offsetLocation, node, "end") ||
      // for node type: `root`
      sourceCode.getLocFromIndex(
        sourceCode.getIndexFromLoc(offsetLocation) +
          (node).source.input.css.length,
      );
    const end = sourceCode.getIndexFromLoc(endLoc);
    const loc = {
      start: startLoc,
      end: endLoc,
    };

    const astNode = this[typeToConvertMethodName(node.type)](
      node,
      loc,
      start,
      end,
      parent,
    );

    if (astNode == null) {
      return null;
    }
    if (isPostCSSContainer(node) && isVCSSContainerNode(astNode)) {
      astNode.nodes = node.nodes
        .map((n) => this._postcssNodeToASTNode(offsetLocation, n, astNode))
        .filter(isDefined);
    }
    return astNode;
  }

  parseInternal(css) {
    try {
      return postcss.parse(css);
    } catch (e) {
      this.addError(e);
      return postcssSafeParser(css);
    }
  }

  createSelectorParser() {
    return new CSSSelectorParser(this.sourceCode, this.commentContainer);
  }

  /**
   * Convert root Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {VCSSStyleSheet}
   */
  convertRootNode(
    node,
    loc,
    start,
    end,
  ) {
    return new VCSSStyleSheet(node, loc, start, end, { lang: this.lang });
  }

  /**
   * Convert rule Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {VCSSStyleRule}
   */
  convertRuleNode(
    node,
    loc,
    start,
    end,
    parent,
  ) {
    const astNode = new VCSSStyleRule(node, loc, start, end, {
      parent,
      rawSelectorText: this.getRaw(node, "selector")?.raw ?? null,
    });
    astNode.selectors = this.selectorParser.parse(
      astNode.rawSelectorText,
      astNode.loc.start,
      astNode,
    );

    if (this.getRaw(node, "between")?.trim()) {
      this.parseRuleRawsBetween(node, astNode);
    }

    return astNode;
  }

  parseRuleRawsBetween(node, astNode) {
    const between = this.getRaw(node, "between");
    const rawSelector = this.getRaw(node, "selector")?.raw ?? node.selector;
    const betweenStart = astNode.range[0] + rawSelector.length;
    const postcssRoot = this.parseInternal(between || "");

    this._postcssNodeToASTNode(
      this.sourceCode.getLocFromIndex(betweenStart),
      postcssRoot,
    );
  }

  /**
   * Convert atrule Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {VCSSAtRule}
   */
  convertAtruleNode(
    node,
    loc,
    start,
    end,
    parent,
  ) {
    const astNode = new VCSSAtRule(node, loc, start, end, {
      parent,
      rawParamsText: this.getRaw(node, "params")?.raw ?? null,
      identifier: this.getRaw(node, "identifier") ?? "@",
    });
    if (node.name === "nest") {
      // The parameters following `@nest` are parsed as selectors.
      const paramsStartIndex =
        astNode.range[0] + // start index of at-rule
        astNode.identifier.length + // `@`
        astNode.name.length + // `nest`
        (this.getRaw(node, "afterName") || "").length; // comments and spaces

      astNode.selectors = this.selectorParser.parse(
        astNode.rawParamsText,
        this.sourceCode.getLocFromIndex(paramsStartIndex),
        astNode,
      );
    }

    if (this.getRaw(node, "afterName")?.trim()) {
      this.parseAtruleRawsAfterName(node, astNode);
    }
    if (this.getRaw(node, "between")?.trim()) {
      this.parseAtruleRawsBetween(node, astNode);
    }

    return astNode;
  }

  parseAtruleRawsAfterName(node, astNode) {
    const afterName = this.getRaw(node, "afterName");

    const afterNameStart =
      astNode.range[0] + // start index of at-rule
      astNode.identifier.length + // `@`
      astNode.name.length; // `nest`
    const postcssRoot = this.parseInternal(afterName || "");

    this._postcssNodeToASTNode(
      this.sourceCode.getLocFromIndex(afterNameStart),
      postcssRoot,
    );
  }

  parseAtruleRawsBetween(node, astNode) {
    const between = this.getRaw(node, "between");

    const rawParams = this.getRaw(node, "params")?.raw ?? node.params;
    const betweenStart =
      astNode.range[0] + // start index of at-rule
      astNode.identifier.length + // `@`
      astNode.name.length + // `nest`
      (this.getRaw(node, "afterName") || "").length + // comments and spaces
      rawParams.length;

    const postcssRoot = this.parseInternal(between || "");
    this._postcssNodeToASTNode(
      this.sourceCode.getLocFromIndex(betweenStart),
      postcssRoot,
    );
  }

  /**
   * Convert decl Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {VCSSDeclarationProperty}
   */
  convertDeclNode(
    node,
    loc,
    start,
    end,
    parent,
  ) {
    // adjust star hack
    // `*color: red`
    //  ^
    let property = node.prop;
    let starLength = 1;
    let textProp = this.sourceCode.text.slice(start, start + property.length);
    while (property !== textProp) {
      property = textProp.slice(0, starLength) + node.prop;

      starLength++;
      textProp = this.sourceCode.text.slice(start, start + property.length);
    }

    return new VCSSDeclarationProperty(node, loc, start, end, {
      parent,
      property,
    });
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
    this.commentContainer.push(
      new VCSSComment(node, node.text, loc, start, end, { parent }),
    );
    return null;
  }

  /**
   * Convert unknown Node
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {Node} parent  The parent node.
   * @returns {Node}
   */
  convertUnknownTypeNode(
    node,
    loc,
    start,
    end,
    parent,
  ) {
    return new VCSSUnknown(node, loc, start, end, {
      parent,
      unknownType: node.type,
    });
  }

  getRaw(
    node,
    keyName,
  ) {
    return (node.raws)[keyName];
  }
}

/**
 * Convert PostCSS location to ESLint location.
 * @param {LineAndColumnData} offsetLocation start location of selector.
 * @param {object} loc the PostCSS location to convert
 * @return {LineAndColumnData} converted location.
 */
function getESLintLineAndColumnFromPostCSSPosition(
  offsetLocation,
  loc,
) {
  let { line } = loc;
  let column = loc.column - 1; // Change to 0 base.
  if (line === 1) {
    line = offsetLocation.line;
    column = offsetLocation.column + column;
  } else {
    line = offsetLocation.line + line - 1;
  }
  return { line, column };
}

/**
 * Convert PostCSS location to ESLint location.
 * @param {LineAndColumnData} offsetLocation location of inside the `<style>` node.
 * @param {object} node the PostCSS node to convert
 * @param {"start"|"end"} locName the name of location
 * @return {LineAndColumnData} converted location.
 */
function getESLintLineAndColumnFromPostCSSNode(
  offsetLocation,
  node,
  locName,
) {
  const sourceLoc = node.source[locName];
  if (!sourceLoc) {
    return null;
  }
  const { line, column } = getESLintLineAndColumnFromPostCSSPosition(
    offsetLocation,
    sourceLoc,
  );
  if (
    locName === "end" &&
    // The end location of the PostCSS root node has a different position than other nodes.
    node.type !== "root"
  ) {
    // End column is shifted by one.
    return { line, column: column + 1 };
  }
  return { line, column };
}

const convertNodeTypes = {
  root: "convertRootNode",
  atrule: "convertAtruleNode",
  rule: "convertRuleNode",
  decl: "convertDeclNode",
  comment: "convertCommentNode",
};

/**
 * Get convert method name from given type
 */
function typeToConvertMethodName(
  type,
) {
  return convertNodeTypes[type] || "convertUnknownTypeNode";
}