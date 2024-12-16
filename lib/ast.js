/**
 * The node
 */
class Node {
  /**
   * constructor.
   * @param  {PostCSSNode | PostCSSSPNode} node PostCSS node.
   * @param  {string} type The token type.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    type,
    loc,
    start,
    end,
    lang
  ) {
    this.type = type;
    this.loc = loc;
    this.start = start;
    this.end = end;
    this.range = [start, end];
    this.node = node;
    this.lang = lang;
  }
}

/**
 * The has parent node
 */
class HasParentNode extends Node {
  constructor(
    node,
    type,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, type, loc, start, end, props.parent.lang);
    this.parent = props.parent;
  }
}
/**
 * The CSS Parsing Error.
 */
export class VCSSParsingError extends Node {
  /**
   * constructor.
   * @param  {PostCSSDeclaration} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSParsingError", loc, start, end, props.lang);
    this.message = props.message;
  }
}

/**
 * The CSS root node.
 */
export class VCSSStyleSheet extends Node {
  /**
   * constructor.
   * @param  {PostCSSRoot} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSStyleSheet", loc, start, end, props.lang);
    this.nodes = props.nodes ?? [];
    this.comments = props.comments ?? [];
    this.errors = props.errors ?? [];
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSStyleSheet} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Rule node.
 */
export class VCSSStyleRule extends HasParentNode {
  /**
   * constructor.
   * @param  {AtRule} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSStyleRule", loc, start, end, props);

    this.selectorText = props.selectorText ?? node.selector;
    if (props.rawSelectorText != null) {
      this.rawSelectorText = props.rawSelectorText;
    } else {
      const raws = node.raws;
      this.rawSelectorText = raws.selector ? raws.selector.raw : node.selector;
    }
    this.selectors = props.selectors ?? [];
    this.nodes = props.nodes ?? [];
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSStyleRule} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Declaration Property node.
 */
export class VCSSDeclarationProperty extends HasParentNode {
  /**
   * constructor.
   * @param  {PostCSSDeclaration} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSDeclarationProperty", loc, start, end, props);

    this.property = props.property ?? node.prop;
    this.value = getProp(props, node, "value");
    this.important = props.important ?? Boolean(node.important);
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSDeclarationProperty} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS At(@) Rule node.
 */
export class VCSSAtRule extends HasParentNode {
  /**
   * constructor.
   * @param  {PostCSSAtRule} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSAtRule", loc, start, end, props);
    this.node = node;

    this.name = getProp(props, node, "name");
    this.identifier = props.identifier;
    this.paramsText = props.paramsText ?? node.params;
    if (props.rawParamsText != null) {
      this.rawParamsText = props.rawParamsText;
    } else {
      const raws = node.raws;
      this.rawParamsText = raws.params?.raw ?? node.params;
    }
    this.selectors = props.selectors ?? undefined;
    this.nodes = props.nodes ?? [];
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSAtRule} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}

/**
 * The CSS Unknown.
 */
export class VCSSUnknown extends HasParentNode {
  /**
   * constructor.
   * @param  {PostCSSNode} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSUnknown", loc, start, end, props);

    this.nodes = props.nodes ?? [];
    this.unknownType = props.unknownType;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSUnknown} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}

/**
 * The CSS Selector node.
 */
export class VCSSSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSSelector", loc, start, end, props);

    this.nodes = props.nodes ?? [];
    this.parent = props.parent;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSSelector} copy node
   */
  copy(props){
    return copyStdNode(this, props);
  }

  get selector() {
    return this.nodes.map((n) => n.selector).join("");
  }
}
/**
 * The CSS Type Selector node.
 */
export class VCSSTypeSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSTypeSelector", loc, start, end, props);
    this.value = getProp(props, node, "value");
    this.selector = this.value;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSTypeSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS ID Selector node.
 */
export class VCSSIDSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props,
  ) {
    super(node, "VCSSIDSelector", loc, start, end, props);
    this.value = getProp(props, node, "value");
    this.selector = `#${this.value}`;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSIDSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Class Selector node.
 */
export class VCSSClassSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSClassSelector", loc, start, end, props);
    this.value = getProp(props, node, "value");
    this.selector = `.${this.value}`;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSClassSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Nesting Selector node.
 */
export class VCSSNestingSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSNestingSelector", loc, start, end, props);
    this.value = getProp(props, node, "value");
    this.selector = this.value;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSNestingSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Universal Selector node.
 */
export class VCSSUniversalSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSUniversalSelector", loc, start, end, props);
    this.value = getProp(props, node, "value");
    this.selector = this.value;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSUniversalSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Attribuute Selector node.
 */
export class VCSSAttributeSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSAttributeSelector", loc, start, end, props);

    this.attribute = getProp(props, node, "attribute");
    const operator = getProp(props, node, "operator");
    this.operator = operator ?? null;
    const value = getProp(props, node, "value");
    this.value = value ?? null;
    const quoteMark = getProp(props, node, "quoteMark");
    this.quoteMark = quoteMark ?? null;

    const raws = node.raws;
    if (props.insensitiveFlag != null) {
      this.insensitiveFlag = props.insensitiveFlag;
    } else if (raws.insensitiveFlag != null) {
      this.insensitiveFlag = raws.insensitiveFlag;
    } else if (node.insensitive) {
      this.insensitiveFlag = "i";
    } else {
      this.insensitiveFlag = null;
    }
    this.selector = this.refreshSelector();
  }

  refreshSelector() {
    let selector = `[${this.attribute}`;
    if (this.operator != null) {
      selector += this.operator;
      if (this.value != null) {
        selector += this.quoteMark
          ? this.quoteMark + this.value + this.quoteMark
          : this.value;
      }
    }
    if (this.insensitiveFlag != null) {
      selector += ` ${this.insensitiveFlag}`;
    }
    selector += "]";
    return selector;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSAttributeSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}
/**
 * The CSS Pseudo node.
 */
export class VCSSSelectorPseudo extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSSelectorPseudo", loc, start, end, props);
    this.value = getProp(props, node, "value");

    this.nodes = props.nodes ?? [];
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSSelectorPseudo} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }

  get selector() {
    if (!this.nodes.length) {
      return this.value;
    }
    const params = this.nodes.map((n) => n.selector).join(",");
    return `${this.value}(${params})`;
  }
}

/**
 * The CSS Selector Combinator node.
 */
export class VCSSSelectorCombinator extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSSelectorCombinator", loc, start, end, props);
    this.value = getProp(props, node, "value");
    this.selector = this.value;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSSelectorCombinator} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}

/**
 * The CSS Unknown Selector node.
 */
export class VCSSUnknownSelector extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSUnknownSelector", loc, start, end, props);
    this.value = getProp(props, node, "value") || "";
    this.selector = this.value;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSUnknownSelector} copy node
   */
  copy(props) {
    return copyStdNode(this, props);
  }
}

/**
 * The CSS Comment node.
 */
export class VCSSComment extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {string} text  The contents.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    text,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSComment", loc, start, end, props);
    this.node = node;
    this.text = text;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSComment} copy node
   */
  copy(props) {
    const parent = props?.parent ?? this.parent;
    return new VCSSComment(
      props?.node ?? this.node,
      props?.text ?? this.text,
      props?.loc ?? this.loc,
      props?.start ?? this.start,
      props?.end ?? this.end,
      { ...this, ...props, parent },
    );
  }
}
/**
 * The CSS Inline Comment node.
 */
export class VCSSInlineComment extends HasParentNode {
  /**
   * constructor.
   * @param  {object} node  The node.
   * @param  {string} text  The contents.
   * @param  {SourceLocation} loc  The location.
   * @param  {number} start  The index of start.
   * @param  {number} end  The index of end.
   * @param  {object} props  The optional property.
   * @returns {void}
   */
  constructor(
    node,
    text,
    loc,
    start,
    end,
    props = {},
  ) {
    super(node, "VCSSInlineComment", loc, start, end, props);
    this.node = node;
    this.text = text;
  }

  /**
   * Copy
   * @param  {object} props  The optional change property.
   * @returns {VCSSInlineComment} copy node
   */
  copy(props) {
    const parent = props?.parent ?? this.parent;
    return new VCSSInlineComment(
      props?.node ?? this.node,
      props?.text ?? this.text,
      props?.loc ?? this.loc,
      props?.start ?? this.start,
      props?.end ?? this.end,
      { ...this, ...props, parent },
    );
  }
}

/**
 * Get property from given props or node
 * @param {object} props The optional property.
 * @param {object} node The node.
 * @param {string} name name of property
 */
function getProp(
  props,
  node,
  name,
) {
  if (props?.[name] != null) {
    const v = props[name];
    return v;
  }
  return node[name];
}

/**
 * Copy the given ASTNode.
 * @param astNode ASTNode
 * @param props The optional property.
 */
function copyStdNode(
  astNode,
  props,
) {
  const C = astNode.constructor;
  return new C(
    props?.node ?? astNode.node,
    props?.loc ?? astNode.loc,
    props?.start ?? astNode.start,
    props?.end ?? astNode.end,
    { ...astNode, ...props },
  );
}