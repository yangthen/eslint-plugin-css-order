import lodash from "lodash";

function isPostCSSSPContainer(node) {
  return node.nodes != null;
}

class SourceCodeLocationResolver {
  /**
   * constructor
   */
  constructor(code) {
    const lineStartIndices = [0];

    let match = undefined;
    const lineEndingPattern = /\r\n|[\n\r\u2028\u2029]/gu;
    while ((match = lineEndingPattern.exec(code))) {
      lineStartIndices.push(match.index + match[0].length);
    }
    this.text = code;
    this.lineStartIndices = lineStartIndices;
  }

  /**
   * Converts a source text index into a (line, column) pair.
   * @param {number} index The index of a character in a file
   * @returns {object} A {line, column} location object with a 0-indexed column
   */
  getLocFromIndex(index) {
    const code = this.text;
    const lineStartIndices = this.lineStartIndices;
    if (index === code.length) {
      return {
        line: lineStartIndices.length,
        column: index - lineStartIndices[lineStartIndices.length - 1],
      };
    }
    const lineNumber = lodash.sortedLastIndex(lineStartIndices, index);

    return {
      line: lineNumber,
      column: index - lineStartIndices[lineNumber - 1],
    };
  }

  /**
   * Converts a (line, column) pair into a range index.
   * @param {Object} loc A line/column location
   * @param {number} loc.line The line number of the location (1-indexed)
   * @param {number} loc.column The column number of the location (0-indexed)
   * @returns {number} The range index of the location in the file.
   * @public
   */
  getIndexFromLoc(loc) {
    const lineStartIndices = this.lineStartIndices;
    const lineStartIndex = lineStartIndices[loc.line - 1];
    const positionIndex = lineStartIndex + loc.column;

    return positionIndex;
  }
}

class RemapIndexContext {

  constructor() {
    this.mappers = [];
    this.newIndex = 0;
    this.orgIndex = 0;
    this.batchLengthOrg = 0;
    this.batchLengthNew = 0;
  }

  applyEq(length) {
    if (length <= 0) {
      return;
    }
    this.flush();
    const newEnd = this.newIndex + length;
    const orgEnd = this.orgIndex + length;
    this.addMap([this.orgIndex, orgEnd], [this.newIndex, newEnd]);
    this.newIndex = newEnd;
    this.orgIndex = orgEnd;
  }

  applyIns(length) {
    this.batchLengthNew += length;
  }

  applyDel(length) {
    this.batchLengthOrg += length;
  }

  flush() {
    if (this.batchLengthNew || this.batchLengthOrg) {
      const newEnd = this.newIndex + this.batchLengthNew;
      const orgEnd = this.orgIndex + this.batchLengthOrg;
      this.addMap([this.orgIndex, orgEnd], [this.newIndex, newEnd]);
      this.newIndex = newEnd;
      this.orgIndex = orgEnd;
      this.batchLengthOrg = 0;
      this.batchLengthNew = 0;
    }
  }

  addMap(orgRange, newRange) {
    if (orgRange[0] === newRange[0] && orgRange[1] === newRange[1]) {
      return;
    }
    this.mappers.unshift({
      org: orgRange,
      new: newRange,
    });
  }

  hasMapping() {
    return this.mappers.length > 0;
  }

  remapIndex(index) {
    for (const mapper of this.mappers) {
      if (mapper.new[0] <= index && index < mapper.new[1]) {
        const offset = index - mapper.new[0];
        return Math.min(mapper.org[0] + offset, mapper.org[1] - 1);
      }
      if (index === mapper.new[1]) {
        return mapper.org[1];
      }
    }
    return index;
  }
}

class Pattern {
  constructor(name, pattern) {
    this.finished = false;
    this.lastResult = null;
    this.name = name;
    if (!pattern.flags.includes("g")) {
      throw new Error("'pattern' should contains 'g' flag.");
    }
    this.pattern = pattern;
  }

  exec(str, index) {
    if (this.finished) {
      return null;
    }
    const { lastResult, pattern } = this;
    if (lastResult && lastResult.index >= index) {
      return lastResult;
    }
    pattern.lastIndex = index;
    const r = (this.lastResult = pattern.exec(str));
    if (!r) {
      this.finished = true;
    }
    return r;
  }
}

/**
 * Define generator to search patterns.
 */
export function* definePatternsSearchGenerator(regexps, str,) {
  const patterns = Object.entries(regexps).map(
    ([name, reg]) => new Pattern(name, reg),
  );
  let start = 0;
  while (true) {
    let result = null;
    let name = "";
    for (const pattern of patterns) {
      const res = pattern.exec(str, start);
      if (res && (!result || res.index < result.index)) {
        result = res;
        name = pattern.name;
      }
    }
    if (!result) {
      return;
    }
    start = result.index + result[0].length;
    yield {
      name,
      result,
    };
  }
}

export class ReplaceSelectorContext {
  constructor(
    cssSelector,
    originalSelector,
    remapContext,
    replaces,
    comments,
  ) {
    this.cssSelector = cssSelector;
    this.remapContext = remapContext;
    this.replaces = replaces;
    this.comments = comments;
    this.cssSourceCode = new SourceCodeLocationResolver(cssSelector);
    this.originalSourceCode = new SourceCodeLocationResolver(originalSelector);
  }

  hasReplace() {
    return (
      this.remapContext.hasMapping() ||
      Boolean(this.replaces.length || this.comments.length)
    );
  }
}

/**
 * Replace selector
 * @param selector selector
 * @param regexps text regexps
 * @param commentRegexps comment regexps
 */
export function replaceSelector(
  selector,
  regexps,
  commentRegexps = [],
  trivialRegexps = [],
) {
  const remapContext = new RemapIndexContext();
  const replaces = [];
  const comments = [];

  const cssSelector = [];
  let start = 0;
  for (const { name, result: res } of definePatternsSearchGenerator(
    {
      block: /\/\*[\s\S]+?\*\//gu, // block comment
      dstr: /"(?:[^"\\]|\\.)*"/gu, // string
      sstr: /'(?:[^'\\]|\\.)*'/gu, // string
      ...commentRegexps.reduce(
        (o, r, i) => {
          o[`${i}comment`] = r.regexp;
          return o;
        },
        {},
      ), // inline comment
      ...regexps.reduce(
        (o, r, i) => {
          o[`${i}text`] = r.regexp;
          return o;
        },
        {},
      ), // interpolation
      ...trivialRegexps.reduce(
        (o, r, i) => {
          o[`${i}trivial`] = r.regexp;
          return o;
        },
        {},
      ), // trivial
    },
    selector,
  )) {
    const plain = selector.slice(start, res.index);
    const text = res[0];
    if (
      name === "block" || // block comment
      name === "dstr" || // string
      name === "sstr" // string
    ) {
      cssSelector.push(plain);
      cssSelector.push(text);
      remapContext.applyEq(plain.length);
      remapContext.applyEq(text.length);
      start = res.index + text.length;
      continue;
    }
    let replacers, container;
    if (name.endsWith("comment")) {
      // inline comment
      replacers = commentRegexps;
      container = comments;
    } else if (name.endsWith("text")) {
      // interpolate
      replacers = regexps;
      container = replaces;
    } else {
      // trivial
      replacers = trivialRegexps;
      container = [];
    }
    const index = parseInt(name, 10);
    const genFunction = replacers[index].replace;
    let random = randomStr();
    while (cssSelector.includes(random) || selector.includes(random)) {
      random = randomStr();
    }

    cssSelector.push(plain);

    const replace = genFunction(res, random, {
      beforeCss: cssSelector,
    });

    container.push({
      start: res.index,
      original: text,
      random,
      replace,
      restore: replacers[index].restore,
    });

    cssSelector.push(replace);

    remapContext.applyEq(plain.length);
    remapContext.applyIns(replace.length);
    remapContext.applyDel(text.length);

    start = res.index + text.length;
  }
  const plain = selector.slice(start);
  cssSelector.push(plain);
  remapContext.applyEq(plain.length);
  remapContext.flush();
  return new ReplaceSelectorContext(
    cssSelector.join(""),
    selector,
    remapContext,
    replaces,
    comments,
  );
}

/**
 * Restore each node's the location and the replaced interpolation and replaced inline comments.
 */
export function restoreReplacedSelector(
  orgNode,
  replaceSelectorContext,
) {
  let node = orgNode;
  const {
    remapContext,
    replaces,
    comments,
    originalSourceCode,
    cssSourceCode,
    cssSelector,
  } = replaceSelectorContext;

  if (node.source) {
    let cssStartIndex = null;
    let cssEndIndex = null;
    if (node.source.start) {
      const cssLoc = node.source.start;
      const index = cssSourceCode.getIndexFromLoc({
        line: cssLoc.line,
        column: cssLoc.column - 1,
      });
      const originalIndex = remapContext.remapIndex(index);
      const originalLoc = originalSourceCode.getLocFromIndex(originalIndex);
      originalLoc.column++;
      node.source.start = originalLoc;
      cssStartIndex = index;
    }
    if (node.source.end) {
      const cssLoc = node.source.end;
      const index = cssSourceCode.getIndexFromLoc({
        line: cssLoc.line,
        column: cssLoc.column,
      });
      const originalIndex = remapContext.remapIndex(index);
      node.source.end = originalSourceCode.getLocFromIndex(originalIndex);
      cssEndIndex = index;
    }
    const cssText =
      cssStartIndex != null && cssEndIndex != null
        ? cssSelector.slice(cssStartIndex, cssEndIndex)
        : null;
    let n;
    while ((n = restoreReplaceds(node, replaces, cssText))) {
      // loop
      node = n;
    }
    while (restoreComments(node, comments, cssText)) {
      // loop
    }
  }
  if (isPostCSSSPContainer(node)) {
    for (let index = 0; index < node.nodes.length; index++) {
      node.nodes[index] = restoreReplacedSelector(
        node.nodes[index],
        replaceSelectorContext,
      );
    }
  }
  return node;
}

/**
 * Restore interpolation for given node
 */
function restoreReplaceds(
  node,
  replaces,
  cssText,
) {
  if (!replaces.length) {
    return null;
  }
  const targetProperties = [];
  if (
    node.type === "tag" ||
    node.type === "class" ||
    node.type === "id" ||
    node.type === "combinator" ||
    node.type === "pseudo" ||
    node.type === "string"
  ) {
    targetProperties.push("value");
  } else if (node.type === "attribute") {
    targetProperties.push("attribute");
    targetProperties.push("value");
  }

  for (let index = 0; index < replaces.length; index++) {
    const replace = replaces[index];
    if (cssText != null && !cssText.includes(replace.random)) {
      continue;
    }
    for (const prop of targetProperties) {
      if (replace.restore) {
        const newNode = replace.restore(node, replace.random, replace.original);
        if (newNode) {
          replaces.splice(index, 1);
          return newNode;
        }
      }
      if (restoreReplaceNodeProp(node, prop, replace)) {
        replaces.splice(index, 1);
        return node;
      }
    }
  }

  return null;
}

/**
 * Restore inline comments for given node
 */
function restoreComments(
  node,
  comments,
  cssText,
) {
  if (!comments.length) {
    return false;
  }
  const targetProperties = [];
  if (node.type === "comment") {
    targetProperties.push("value");
  }
  if (hasRaws(node)) {
    targetProperties.push("raws.spaces.after");
    targetProperties.push("raws.spaces.before");
  }

  for (let index = 0; index < comments.length; index++) {
    const comment = comments[index];
    if (
      node.type === "comment" &&
      cssText != null &&
      !cssText.includes(comment.random)
    ) {
      continue;
    }
    for (const prop of targetProperties) {
      if (restoreReplaceNodeProp(node, prop, comment)) {
        comments.splice(index, 1);
        return true;
      }
    }
  }
  return false;
}

/**
 * Restore replaced text
 */
function restoreReplaceNodeProp(
  node,
  prop,
  replaceInfo,
) {
  const text = `${lodash.get(node, prop, "") || ""}`;
  if (text.includes(replaceInfo.replace)) {
    const newText = text.replace(replaceInfo.replace, replaceInfo.original);
    lodash.set(node, prop, newText);
    if (!prop.startsWith("raws")) {
      lodash.set(node, `raws.${prop}`, newText);
    }
    return true;
  }
  return false;
}

/**
 * Checks whether has raws
 */
function hasRaws(
  node,
) {
  return node.raws != null;
}

/**
 * @return Returns the random string.
 */
function randomStr() {
  const S = "abcdefghijklmnopqrstuvwxyz0123456789";
  const N = 16;
  return Array.from(Array(N))
    .map(() => S[Math.floor(Math.random() * S.length)])
    .join("");
}