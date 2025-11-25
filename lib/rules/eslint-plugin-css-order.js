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
          const styleArr = style.cssText.split('\r\n')
          
          // 分析每一行的类型和缩进
          const lineInfos = styleArr.map((line, index) => {
            const trimmed = line.trim()
            const indent = line.match(/^(\s*)/)[1].length
            return {
              index,
              text: line,
              trimmed,
              indent,
              isEmpty: trimmed === '',
              isComment: trimmed.startsWith('//') || trimmed.startsWith('/*'),
              isSelector: trimmed.includes('{') && !trimmed.endsWith('}'),
              isCloseBrace: trimmed === '}' || trimmed.startsWith('}'),
              isProperty: trimmed.includes(':') && !trimmed.includes('{') && !trimmed.startsWith('//'),
              isPropertyContinuation: false, // 标记是否为属性值的续行
              parentPropertyIndex: -1 // 记录续行所属的属性索引
            }
          })
          
          // 识别多行属性值
          for (let i = 0; i < lineInfos.length; i++) {
            const lineInfo = lineInfos[i]
            if (lineInfo.isProperty) {
              // 检查属性值是否完整（是否以分号结尾）
              if (!lineInfo.trimmed.endsWith(';') && !lineInfo.trimmed.endsWith('}')) {
                // 标记后续行为属性值的续行
                let j = i + 1
                while (j < lineInfos.length) {
                  const nextLine = lineInfos[j]
                  if (nextLine.isEmpty || nextLine.isComment) {
                    j++
                    continue
                  }
                  
                  // 标记为续行
                  nextLine.isPropertyContinuation = true
                  nextLine.isProperty = false
                  nextLine.parentPropertyIndex = i
                  
                  // 如果这行以分号或右括号加分号，说明属性值结束
                  if (nextLine.trimmed.endsWith(';') || nextLine.trimmed.match(/\);?\s*$/)) {
                    break
                  }
                  j++
                }
              }
            }
          }
          
          // 找出所有CSS属性块
          const propertyBlocks = []
          let currentBlock = null
          const indentUnit = 2
          
          // 先计算每个选择器的正确缩进
          let tempIndentStack = [0]
          const correctIndents = new Map() // 存储每行的正确缩进
          
          lineInfos.forEach((lineInfo) => {
            if (lineInfo.isSelector) {
              const correctIndent = tempIndentStack[tempIndentStack.length - 1]
              correctIndents.set(lineInfo.index, correctIndent)
              tempIndentStack.push(correctIndent + indentUnit)
            } else if (lineInfo.isCloseBrace) {
              tempIndentStack.pop()
              const correctIndent = tempIndentStack[tempIndentStack.length - 1] || 0
              correctIndents.set(lineInfo.index, correctIndent)
            }
          })
          
          lineInfos.forEach((lineInfo) => {
            if (lineInfo.isSelector) {
              // 遇到选择器，准备收集下一个块的属性
              if (currentBlock && currentBlock.properties.length > 0) {
                propertyBlocks.push(currentBlock)
              }
              const correctSelectorIndent = correctIndents.get(lineInfo.index) || 0
              currentBlock = {
                selectorIndex: lineInfo.index,
                selectorIndent: lineInfo.indent,
                correctSelectorIndent: correctSelectorIndent,
                blockIndent: correctSelectorIndent + indentUnit, // 使用正确的选择器缩进计算
                properties: [],
                startIndex: lineInfo.index + 1
              }
            } else if (currentBlock && lineInfo.isProperty) {
              // 收集完整的多行属性
              const propertyLines = [lineInfo]
              
              // 如果属性值跨多行，收集所有续行
              if (!lineInfo.trimmed.endsWith(';') && !lineInfo.trimmed.endsWith('}')) {
                let j = lineInfo.index + 1
                while (j < lineInfos.length && lineInfos[j].isPropertyContinuation) {
                  propertyLines.push(lineInfos[j])
                  if (lineInfos[j].trimmed.endsWith(';') || lineInfos[j].trimmed.match(/\);?\s*$/)) {
                    break
                  }
                  j++
                }
              }
              
              currentBlock.properties.push({
                ...lineInfo,
                lines: propertyLines,
                endIndex: propertyLines[propertyLines.length - 1].index
              })
            } else if (lineInfo.isCloseBrace && currentBlock) {
              if (currentBlock.properties.length > 0) {
                currentBlock.endIndex = lineInfo.index
                propertyBlocks.push(currentBlock)
              }
              currentBlock = null
            }
          })
          
          const errArr = []
          
          // 检测每个块内属性的缩进一致性
          propertyBlocks.forEach(block => {
            if (block.properties.length > 0) {
              const expectedIndent = block.blockIndent
              block.properties.forEach((prop) => {
                // 检查属性声明行的缩进
                if (prop.indent !== expectedIndent) {
                  errArr.push({
                    index: prop.index,
                    msgId: 'inconsistentIndent'
                  })
                }
                
                // 检查多行属性值内部的缩进
                if (prop.lines && prop.lines.length > 1) {
                  const valueIndent = expectedIndent + indentUnit
                  for (let i = 1; i < prop.lines.length; i++) {
                    const line = prop.lines[i]
                    // 跳过空行
                    if (line.isEmpty) continue
                    
                    // 判断是否为结束行（以 ); 或 ) 结尾）
                    const isClosingLine = line.trimmed.match(/^\);?\s*$/)
                    
                    if (isClosingLine) {
                      // 右括号行应该与属性声明行对齐
                      if (line.indent !== expectedIndent) {
                        errArr.push({
                          index: line.index,
                          msgId: 'inconsistentIndent'
                        })
                      }
                    } else {
                      // 属性值的内容行使用 valueIndent
                      if (line.indent !== valueIndent) {
                        errArr.push({
                          index: line.index,
                          msgId: 'inconsistentIndent'
                        })
                      }
                    }
                  }
                }
              })
            }
          })
          
          // 检测选择器和括号的缩进
          lineInfos.forEach((lineInfo) => {
            if (lineInfo.isEmpty || lineInfo.isComment) return
            
            if (lineInfo.isSelector || lineInfo.isCloseBrace) {
              const expectedIndent = correctIndents.get(lineInfo.index)
              if (expectedIndent !== undefined && lineInfo.indent !== expectedIndent) {
                errArr.push({
                  index: lineInfo.index,
                  msgId: 'inconsistentIndent'
                })
              }
            }
          })
          
          // 检测属性之间的空行（排除属性内部的续行）
          propertyBlocks.forEach(block => {
            block.properties.forEach((prop, idx) => {
              if (idx < block.properties.length - 1) {
                const currentLineEndIndex = prop.endIndex || prop.index
                const nextLineIndex = block.properties[idx + 1].index
                
                if (nextLineIndex - currentLineEndIndex > 1) {
                  for (let i = currentLineEndIndex + 1; i < nextLineIndex; i++) {
                    const lineContent = styleArr[i].trim()
                    if (lineContent === '' && !lineInfos[i].isPropertyContinuation) {
                      errArr.push({
                        index: i,
                        msgId: 'emptyLine'
                      })
                    }
                  }
                }
              }
            })
          })
          
          // 对每个块的属性进行排序
          const sortedBlocks = propertyBlocks.map(block => {
            const sorted = [...block.properties]
            for (let i = 0; i < sorted.length; i++) {
              for (let j = 1; j < sorted.length - i; j++) {
                const curProp = sorted[j].trimmed.split(':')[0].trim()
                const lastProp = sorted[j - 1].trimmed.split(':')[0].trim()
                const curIndex = propertyGroups.findIndex(property => property === curProp)
                const lastIndex = propertyGroups.findIndex(property => property === lastProp)
                
                if (curIndex !== -1 && lastIndex !== -1 && curIndex < lastIndex) {
                  errArr.push({
                    index: sorted[j].index,
                    msgId: 'cssSort'
                  });
                  [sorted[j - 1], sorted[j]] = [sorted[j], sorted[j - 1]]
                }
              }
            }
            return { ...block, sortedProperties: sorted }
          })

          if (errArr.length) {
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
                  // 重建样式文本，保持原有结构
                  const result = []
                  const processedLines = new Set()
                  
                  // 记录哪些行是需要被替换的属性
                  const blockMap = new Map()
                  sortedBlocks.forEach(block => {
                    blockMap.set(block.selectorIndex, block)
                    block.properties.forEach(prop => {
                      processedLines.add(prop.index)
                      // 标记多行属性的所有行
                      if (prop.lines && prop.lines.length > 1) {
                        prop.lines.forEach(line => {
                          processedLines.add(line.index)
                        })
                      }
                    })
                  })
                  
                  // 计算每行的正确缩进
                  let currentIndentStack = [0]
                  
                  styleArr.forEach((line, index) => {
                    const lineInfo = lineInfos[index]
                    
                    // 如果这行是被排序的属性或属性续行，跳过
                    if (processedLines.has(index)) {
                      return
                    }
                    
                    // 根据行类型确定正确的缩进
                    let correctIndent = lineInfo.indent
                    
                    if (lineInfo.isSelector) {
                      correctIndent = currentIndentStack[currentIndentStack.length - 1]
                      const correctedLine = ' '.repeat(correctIndent) + lineInfo.trimmed
                      result.push(correctedLine)
                      currentIndentStack.push(correctIndent + indentUnit)
                      
                      // 在选择器后插入排序后的属性（包括多行属性）
                      if (blockMap.has(index)) {
                        const block = blockMap.get(index)
                        const propIndent = ' '.repeat(block.blockIndent)
                        const valueIndent = ' '.repeat(block.blockIndent + indentUnit)
                        
                        block.sortedProperties.forEach(prop => {
                          if (prop.lines && prop.lines.length > 1) {
                            // 多行属性：第一行使用属性缩进，后续行根据内容使用不同缩进
                            prop.lines.forEach((line, idx) => {
                              if (idx === 0) {
                                result.push(propIndent + line.trimmed)
                              } else {
                                // 判断是否为结束行
                                const isClosingLine = line.trimmed.match(/^\);?\s*$/)
                                if (isClosingLine) {
                                  // 右括号行与属性声明行对齐
                                  result.push(propIndent + line.trimmed)
                                } else {
                                  // 其他续行使用值缩进
                                  result.push(valueIndent + line.trimmed)
                                }
                              }
                            })
                          } else {
                            // 单行属性
                            result.push(propIndent + prop.trimmed)
                          }
                        })
                      }
                    } else if (lineInfo.isCloseBrace) {
                      currentIndentStack.pop()
                      correctIndent = currentIndentStack[currentIndentStack.length - 1] || 0
                      const correctedLine = ' '.repeat(correctIndent) + lineInfo.trimmed
                      result.push(correctedLine)
                    } else if (lineInfo.isEmpty || lineInfo.isComment) {
                      // 空行和注释保持原样
                      result.push(line)
                    } else {
                      // 其他行（如果有的话）
                      result.push(line)
                    }
                  })
                  
                  // 移除首尾的空行
                  while (result.length > 0 && result[0].trim() === '') {
                    result.shift()
                  }
                  while (result.length > 0 && result[result.length - 1].trim() === '') {
                    result.pop()
                  }
                  
                  // 确保首尾有换行符
                  const finalResult = result.length > 0 ? '\r\n' + result.join('\r\n') + '\r\n' : ''
                  
                  return fixer.replaceTextRange(
                    [style.cssNode.range[0] + 1, style.cssNode.range[1] - 1],
                    finalResult
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
