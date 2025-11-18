/**
 * @fileoverview sort css styles
 * @author yangthen
 */
'use strict'

import { getSourceCode } from 'eslint-compat-utils'
import lodash from 'lodash'
import { CSSParser } from '../css-parser.js'
import { SCSSParser } from '../scss-parser.js'
import { StylusParser } from '../stylus-parser.js'
import path from 'path'
import fs from 'fs'
import * as defaultConfig from '../properties.js' // 默认配置

// 同步加载用户配置
function loadUserConfigSync () {
  // 配置文件路径
  const configPath = path.join(process.cwd(), 'css-order.config.json')
  // 检查配置文件
  if (fs.existsSync(configPath)) {
    try {
      // 处理 JSON 配置文件
      const content = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (e) {
      console.error(`Error loading config at ${configPath}:`, e)
    }
  }

  // 3. 使用默认配置
  return defaultConfig.default || defaultConfig
}

// 加载配置
const userConfig = loadUserConfigSync()

// 处理配置格式
const propertyGroups = Array.isArray(userConfig)
  ? userConfig
  : userConfig.propertyGroups || userConfig

const CACHE = new WeakMap()

function getCache (context) {
  const sourceCode = getSourceCode(context)
  const { ast } = sourceCode
  if (CACHE.has(ast)) {
    return CACHE.get(ast)
  }
  const cache = {}
  CACHE.set(ast, cache)
  return cache
}

function isVElement (node) {
  return node?.type === 'VElement'
}

function getStyleElements (context) {
  let document = null
  const sourceCode = getSourceCode(context)
  if (sourceCode.parserServices.getDocumentFragment) {
    // vue-eslint-parser v7.0.0
    document = sourceCode.parserServices.getDocumentFragment()
  } else {
    const { ast } = sourceCode
    const templateBody = ast.templateBody || undefined
    /* istanbul ignore if */
    if (templateBody) {
      document = templateBody.parent
    }
  }
  if (document) {
    return document.children
      .filter(isVElement)
      .filter((element) => element.name === 'style')
  }
  return []
}

function getInvalidEOFError (context, style) {
  const node = getSourceCode(context).ast
  const body = node.templateBody
  let errors = body?.errors
  let inDocumentFragment = false
  if (errors == null) {
    const sourceCode = getSourceCode(context)
    /* istanbul ignore if */
    if (!sourceCode.parserServices.getDocumentFragment) {
      return null
    }
    const df = sourceCode.parserServices.getDocumentFragment()
    inDocumentFragment = true
    errors = df?.errors
    /* istanbul ignore if */
    if (errors == null) {
      return null
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
    )
  if (!error) {
    return null
  }
  return {
    error,
    inDocumentFragment,
  }
}

function isScoped (style) {
  const { startTag } = style
  return startTag.attributes.some((attr) => attr.key.name === 'scoped')
}

function isCssModule (style) {
  const { startTag } = style
  return startTag.attributes.some((attr) => attr.key.name === 'module')
}

function getLang (style) {
  const { startTag } = style
  const lang =
    startTag.attributes.find((attr) => attr.key.name === 'lang') || null
  return (
    lang?.type === 'VAttribute' &&
    lang.value?.type === 'VLiteral' &&
    lang.value.value
  )
}

function isSupportedStyleLang (
  lang
) {
  return lang === 'css' || lang === 'scss' || lang === 'stylus'
}

const PARSERS = {
  scss: SCSSParser,
  css: CSSParser,
  stylus: StylusParser
}

function parse (sourceCode, offsetLocation, css, lang,) {
  const Parser = isSupportedStyleLang(lang) ? PARSERS[lang] : CSSParser
  const parser = new Parser(sourceCode, lang)
  return parser.parse(css, offsetLocation)
}

class StyleContextImpl {
  constructor(style, context) {
    this.styleElement = null
    this.sourceCode = null
    this.invalid = {}
    this.scoped = null
    this.module = null
    this.lang = null
    this.cssText = null
    this.cssNode = null

    const sourceCode = getSourceCode(context)
    this.styleElement = style
    this.sourceCode = sourceCode

    const { startTag, endTag } = style
    this.invalid = null
    const eof = getInvalidEOFError(context, style)
    if (eof) {
      this.invalid = {
        message: eof.error.message,
        needReport: eof.inDocumentFragment,
        loc: { line: eof.error.lineNumber, column: eof.error.column },
      }
    } else if (endTag == null && !startTag.selfClosing) {
      this.invalid = {
        message: 'Missing end tag',
        needReport: true,
        loc: startTag.loc.end,
      }
    }

    this.scoped = Boolean(style && isScoped(style))

    this.module = Boolean(style && isCssModule(style))

    this.lang = ((style && getLang(style)) || 'css').toLowerCase()

    if (!this.invalid) {
      this.cssText = endTag
        ? sourceCode.text.slice(startTag.range[1], endTag.range[0])
        : ''
      this.cssNode = parse(
        sourceCode,
        startTag.loc.end,
        this.cssText,
        this.lang,
      )
    } else {
      this.cssText = null
      this.cssNode = null
    }
  }
}

function createStyleContexts (context) {
  const styles = getStyleElements(context)

  return styles.map(
    (style) => new StyleContextImpl(style, context),
  )
}

function getStyleContexts (context) {
  const cache = getCache(context)
  if (cache.styles) {
    return cache.styles
  }
  return (cache.styles = createStyleContexts(context))
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
      emptyLine: 'css属性之间不允许存在空行',
      inconsistentIndent: 'css属性缩进不一致',
    }
  },

  create (context) {
    const styles = getStyleContexts(context)
      .filter((style) => !style.invalid)
    if (!styles.length) {
      return {}
    }
    return {
      'Program:exit' () {
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
              // 只收集有CSS属性的行（不包括空行和纯注释行）
              const properties = styleArr.slice(startIndex + 1, endIndex)
                .map((item, index) => ({
                  index: startIndex + index + 1,
                  text: item,
                  isEmpty: item.trim() === '',
                  isComment: item.trim().startsWith('//') || item.trim().startsWith('/*')
                }))
                .filter(item => !item.isEmpty && item.text.includes(':')) // 只保留有CSS属性的行
              
              if (properties.length > 0) {
                orderArr.push(properties)
              }
            }
          }
          // 有多少样式块进行多少次分割
          styleArr.filter(item => item.includes('{')).map(() => {
            cutStyle()
          })
          
          const errArr = []
          
          // 检测空行和缩进
          orderArr.map(itemArr => {
            if (itemArr.length === 0) return
            
            // 获取第一个属性的缩进作为基准
            const baseIndent = itemArr[0].text.match(/^(\s*)/)[1].length
            
            // 检查每个属性
            itemArr.forEach((item, idx) => {
              const currentIndent = item.text.match(/^(\s*)/)[1].length
              
              // 检测缩进是否一致
              if (currentIndent !== baseIndent) {
                errArr.push({
                  index: item.index,
                  msgId: 'inconsistentIndent'
                })
              }
              
              // 检测属性之间的空行（不包括最后一个属性后的空行）
              if (idx < itemArr.length - 1) {
                const currentLineIndex = item.index
                const nextLineIndex = itemArr[idx + 1].index
                
                // 如果行号不连续，说明中间有间隔
                if (nextLineIndex - currentLineIndex > 1) {
                  // 检查中间的行
                  for (let i = currentLineIndex + 1; i < nextLineIndex; i++) {
                    const lineContent = styleArr[i].trim()
                    // 如果是空行（不是注释），报错
                    if (lineContent === '') {
                      errArr.push({
                        index: i,
                        msgId: 'emptyLine'
                      })
                    }
                    // 如果是非空非注释行，也可能是问题（但已经被过滤了）
                  }
                }
              }
            })
          })
          
          // 重新收集完整的块信息（包括空行位置）用于修复
          const fullBlocks = []
          startIndex = 0
          endIndex = 0
          styleArr.forEach((line, index) => {
            if (line.includes('{')) {
              const blockStart = index
              let blockEnd = index + 1
              while (blockEnd < styleArr.length && 
                     !styleArr[blockEnd].includes('{') && 
                     !styleArr[blockEnd].includes('}') && 
                     !(styleArr[blockEnd].includes(',') && styleArr[blockEnd].substr(-1) === ',')) {
                blockEnd++
              }
              fullBlocks.push({
                startLine: line,
                startIndex: blockStart,
                endIndex: blockEnd,
                lines: styleArr.slice(blockStart + 1, blockEnd)
              })
            }
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
          })

          if (errArr.length) {
            // 去重
            const uniqueErrArr = lodash.uniqBy(errArr, item => `${item.index}-${item.msgId}`)
            uniqueErrArr.map(err => {
              context.report({
                node: style.cssNode,
                messageId: err.msgId,
                loc: {
                  start: { line: style.cssNode.loc.start.line + err.index, column: 0 },
                  end: { line: style.cssNode.loc.start.line + err.index + 1, column: 0 }
                },
                fix (fixer) {
                  // 重建样式文本
                  const result = []
                  let orderIndex = 0
                  let processedLines = new Set() // 记录已处理的行
                  
                  styleArr.forEach((line, index) => {
                    if (line.includes('{')) {
                      // 检查这个 { 前面是否有空行（嵌套选择器前的空行）
                      if (index > 0 && result.length > 0) {
                        const prevLine = styleArr[index - 1]
                        if (prevLine.trim() === '') {
                          result.push('') // 保留空行
                        }
                      }
                      
                      result.push(line)
                      // 添加该块排序后的属性
                      if (orderIndex < orderArr.length) {
                        const blockItems = orderArr[orderIndex]
                        const baseIndent = blockItems[0]?.text.match(/^(\s*)/)?.[1] || '  '
                        
                        blockItems.forEach(item => {
                          const content = item.text.trim()
                          result.push(baseIndent + content)
                          processedLines.add(item.index)
                        })
                        orderIndex++
                      }
                    } else if (line.includes('}') || (line.includes(',') && line.substr(-1) === ',')) {
                      result.push(line)
                    } else if (!processedLines.has(index) && line.trim() !== '' && !line.includes(':')) {
                      // 保留注释行和其他非属性行（但不保留已处理的属性行）
                      result.push(line)
                    }
                  })
                  
                  return fixer.replaceTextRange(
                    [style.cssNode.range[0] + 1, style.cssNode.range[1] - 1],
                    '\r\n' + result.join('\r\n') + '\r\n'
                  )
                }
              })
            })
          }
        }
      }
    }
  },
}
