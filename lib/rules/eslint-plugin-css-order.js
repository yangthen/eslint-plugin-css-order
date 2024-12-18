/**
 * @fileoverview sort css styles
 * @author yangthen
 */
'use strict';

import { getSourceCode } from 'eslint-compat-utils'
import lodash from 'lodash'
import propertyGroups from '../properties.js'
import { CSSParser } from '../css-parser.js'
import { SCSSParser } from '../scss-parser.js'
import { StylusParser } from '../stylus-parser.js'

const CACHE = new WeakMap()

function getCache(context) {
  const sourceCode = getSourceCode(context);
  const { ast } = sourceCode;
  if (CACHE.has(ast)) {
    return CACHE.get(ast);
  }
  const cache = {};
  CACHE.set(ast, cache);
  return cache;
}

function isVElement(node) {
  return node?.type === 'VElement';
}

function getStyleElements(context) {
  let document = null;
  const sourceCode = getSourceCode(context);
  if (sourceCode.parserServices.getDocumentFragment) {
    // vue-eslint-parser v7.0.0
    document = sourceCode.parserServices.getDocumentFragment();
  } else {
    const { ast } = sourceCode;
    const templateBody = ast.templateBody || undefined;
    /* istanbul ignore if */
    if (templateBody) {
      document = templateBody.parent;
    }
  }
  if (document) {
    return document.children
      .filter(isVElement)
      .filter((element) => element.name === 'style');
  }
  return [];
}

function getInvalidEOFError(context, style) {
  const node = getSourceCode(context).ast;
  const body = node.templateBody;
  let errors = body?.errors;
  let inDocumentFragment = false;
  if (errors == null) {
    const sourceCode = getSourceCode(context);
    /* istanbul ignore if */
    if (!sourceCode.parserServices.getDocumentFragment) {
      return null;
    }
    const df = sourceCode.parserServices.getDocumentFragment();
    inDocumentFragment = true;
    errors = df?.errors;
    /* istanbul ignore if */
    if (errors == null) {
      return null;
    }
  }
  const error =
    errors.find(
      (err) =>
        typeof err.code === 'string' &&
        err.code.startsWith('eof-') &&
        style.range[0] <= err.index &&
        err.index < style.range[1],
    ) ||
    errors.find(
      (err) => typeof err.code === 'string' && err.code.startsWith('eof-'),
    );
  if (!error) {
    return null;
  }
  return {
    error,
    inDocumentFragment,
  };
}

function isScoped(style) {
  const { startTag } = style;
  return startTag.attributes.some((attr) => attr.key.name === 'scoped');
}

function isCssModule(style) {
  const { startTag } = style;
  return startTag.attributes.some((attr) => attr.key.name === 'module');
}

function getLang(style) {
  const { startTag } = style;
  const lang =
    startTag.attributes.find((attr) => attr.key.name === 'lang') || null;
  return (
    lang?.type === 'VAttribute' &&
    lang.value?.type === 'VLiteral' &&
    lang.value.value
  );
}

function isSupportedStyleLang(
  lang
) {
  return lang === 'css' || lang === 'scss' || lang === 'stylus';
}

const PARSERS = {
  scss: SCSSParser,
  css: CSSParser,
  stylus: StylusParser
};

function parse(sourceCode, offsetLocation, css, lang,) {
  const Parser = isSupportedStyleLang(lang) ? PARSERS[lang] : CSSParser;
  const parser = new Parser(sourceCode, lang);
  return parser.parse(css, offsetLocation);
}

class StyleContextImpl {
  constructor(style, context) {
    this.styleElement = null
    this.sourceCode = null
    this.invalid = {}
    this.scoped = null;
    this.module = null;
    this.lang = null;
    this.cssText = null;
    this.cssNode = null;
    
    const sourceCode = getSourceCode(context);
    this.styleElement = style;
    this.sourceCode = sourceCode;

    const { startTag, endTag } = style;
    this.invalid = null;
    const eof = getInvalidEOFError(context, style);
    if (eof) {
      this.invalid = {
        message: eof.error.message,
        needReport: eof.inDocumentFragment,
        loc: { line: eof.error.lineNumber, column: eof.error.column },
      };
    } else if (endTag == null && !startTag.selfClosing) {
      this.invalid = {
        message: 'Missing end tag',
        needReport: true,
        loc: startTag.loc.end,
      };
    }

    this.scoped = Boolean(style && isScoped(style));

    this.module = Boolean(style && isCssModule(style));

    this.lang = ((style && getLang(style)) || 'css').toLowerCase();

    if (!this.invalid) {
      this.cssText = endTag
        ? sourceCode.text.slice(startTag.range[1], endTag.range[0])
        : '';
      this.cssNode = parse(
        sourceCode,
        startTag.loc.end,
        this.cssText,
        this.lang,
      );
    } else {
      this.cssText = null;
      this.cssNode = null;
    }
  }
}

function createStyleContexts(context) {
  const styles = getStyleElements(context);

  return styles.map(
    (style) => new StyleContextImpl(style, context),
  );
}

function getStyleContexts(context) {
  const cache = getCache(context);
  if (cache.styles) {
    return cache.styles;
  }
  return (cache.styles = createStyleContexts(context));
}

export default {
  meta: {
    type: 'suggestion', // `problem`, `suggestion`, or `layout`
    docs: {
      description: 'sort css styles',
      recommended: false,
      url: null // URL to the documentation page for this rule
    },
    fixable: 'code', // Or `code` or `whitespace`
    schema: [], // Add a schema if the rule has options
    messages: { // Add messageId and message
      cssSort: 'css属性顺序错误',
      emptyLine: 'css属性存在空行',
      emptyBlock: 'css样式块存在空行',
    }
  },

  create (context) {
    const styles = getStyleContexts(context)
      .filter((style) => !style.invalid);
    if (!styles.length) {
      return {};
    }
    return {
      'Program:exit'() {
        for (const style of styles) {
          // 选取样式并进行排序
          const styleArr = style.cssText.split('\r\n') // 按行分为样式数组
          /*
            选取同个类下的样式如：
            .star1 {
              align-items: center;
              display: flex;
              .content {
                background: red;
                .wrap {
                  display: none;
                }
              }
            }
            .star2 {
              z-index: 10;
              position: relative;
            }
            选取 "{" 到 "{" 或 "}" 或 "," 之间的内容为同一个块
            最终生成的分割数组：
            [
              [
                { index: 2, text: '  align-items: center;' },
                { index: 3, text: '  display: flex;' }
              ],
              [ { index: 5, text: '    background: red;' } ],
              [ { index: 7, text: '      display: none;' } ],
              [
                { index: 12, text: '  z-index: 10;' },
                { index: 13, text: '  position: relative;' }
              ]
            ]
          */
          let orderArr = []
          let startIndex = 0
          let endIndex = 0
          const cutStyle = () => {
            startIndex = styleArr.slice(endIndex).findIndex(item => item.includes('{')) + endIndex
            endIndex = styleArr.slice(startIndex + 1).findIndex(item => {
              return item.includes('{') || item.includes('}') || (item.includes(',') && item.substr(-1) === ',')
            }) + startIndex + 1
            if (styleArr.slice(startIndex + 1, endIndex)?.length) {
              orderArr.push(
                styleArr.slice(startIndex + 1, endIndex).map((item, index) => ({
                  index: startIndex + index + 1,
                  text: item
                }))
              )
            }
          }
          // 有多少样式块进行多少次分割
          styleArr.filter(item => item.includes('{')).map(() => {
            cutStyle()
          })
          // 删除空行
          const errArr = []
          lodash.cloneDeep(orderArr).reverse().map(itemArr => {
            lodash.cloneDeep(itemArr).reverse().map(item => {
              const propertyIndex = propertyGroups.findIndex(property => item.text.split(':')[0].includes(property))
              if (propertyIndex === -1) {
                styleArr.splice(item.index, 1)
                errArr.push({
                  index: item.index,
                  msgId: 'emptyLine'
                })
              }
            })
          })
          // 再进行分割
          orderArr = []
          startIndex = 0
          endIndex = 0
          styleArr.filter(item => item.includes('{')).map(() => {
            cutStyle()
          })
          // 排序
          orderArr.map(itemArr => {
            // 冒泡排序
            for (let i = 0; i < itemArr.length; i++) {
              for (let j = 1; j < itemArr.length - i; j++) {
                const curIndex = propertyGroups.findIndex(property => itemArr[j].text.split(':')[0].trim() === property)
                const lastIndex = propertyGroups.findIndex(property => itemArr[j - 1].text.split(':')[0].trim() === property)
                if (curIndex < lastIndex && curIndex !== -1 && lastIndex !== -1) {
                  errArr.push({
                    index: itemArr[j].index,
                    msgId: 'cssSort'
                  });
                  [itemArr[j - 1], itemArr[j]] = [itemArr[j], itemArr[j - 1]]
                }
              }
            }
            // 根据排序结果重排style
            const minIndex = lodash.min(itemArr.map(item => item.index))
            const maxIndex = lodash.max(itemArr.map(item => item.index))
            for (let i = minIndex; i <= maxIndex; i++) {
              styleArr[i] = itemArr[i - minIndex].text
            }
          })
          // 样式块中间存在空格
          styleArr.map((item, index) => {
            if (index && !item && index < styleArr.length - 1) {
              errArr.push({
                index: index + errArr.filter(item => item.msgId === 'emptyLine').length - 1,
                msgId: 'emptyBlock'
              })
            }
          })
          if (errArr.length) {
            errArr.map(err => {
              context.report({
                node: style.cssNode,
                messageId: err.msgId,
                loc: {
                  start: { line: style.cssNode.loc.start.line + err.index, column: 0 },
                  end: { line:  style.cssNode.loc.start.line + err.index + 1, column: 0 }
                },
                fix(fixer) {
                  return fixer.replaceTextRange(
                    [style.cssNode.range[0] + 1, style.cssNode.range[1] - 1],
                    ['\r\n'].concat(styleArr.filter(item => /[^\r\n\s]/.test(item))).join('\r\n')
                  )
                }
              })
            })
          }
        }
      }
    }
  },
};
