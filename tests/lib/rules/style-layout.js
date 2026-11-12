import assert from 'node:assert/strict'
import { Linter, RuleTester } from 'eslint'
import { it } from 'mocha'
import vueParser from 'vue-eslint-parser'
import plugin, { rules } from '../../../lib/index.js'

const tester = new RuleTester({ languageOptions: { parser: vueParser } })

function style (lines, { lang = 'css', eol = '\n', scoped = false } = {}) {
  const language = lang === 'css' ? '' : ' lang="' + lang + '"'
  const opening = '<style' + language + (scoped ? ' scoped' : '') + '>'
  return [opening, ...lines, '</style>'].join(eol)
}

function testRule (name, valid, invalid) {
  tester.run(name, rules[name], {
    valid: [...valid, ...invalid.filter(test => test.output !== null).map(({ output, options = [] }) => ({ code: output, options }))]
      .map(test => ({ filename: 'component.vue', ...test })),
    invalid: invalid.map(test => ({ filename: 'component.vue', ...test }))
  })
}

const scssCRLF = { lang: 'scss', eol: '\r\n' }
const scopedScss = { ...scssCRLF, scoped: true }
const stylus = { lang: 'stylus' }
const compact = { code: '<style>.x { color: red; display: block; }</style>' }
const invalidCss = { code: style(['.x {', '  color: red', ' display: block;', '}']) }
const multilineValue = [
  '       calc(100dvh - #{reading-size(10)}),',
  '       calc(50dvh - #{reading-size(5)})',
  '  ); // same declaration'
]

testRule('css-indent', [
  compact,
  invalidCss,
  {
    code: style(['.x {', '  /* comment', ' * formatting inside comment', ' */', '  color: red;', '}'])
  },
  {
    code: style(['.x {', '    color: red;', '}'], { lang: 'less' })
  }
], [
  {
    code: style(['  .x {', ' color: red;', '   @media (width > 10px) {', ' color: blue;', '   }', '   }']),
    output: style(['.x {', '  color: red;', '  @media (width > 10px) {', '    color: blue;', '  }', '}']),
    errors: Array.from({ length: 6 }, (_, index) => ({ messageId: 'indent', line: index + 2 }))
  },
  {
    code: style(['\t.x {', '  --top: max(', ...multilineValue, '  }'], scssCRLF),
    output: style(['\t.x {', '\t\t--top: max(', ...multilineValue, '\t}'], scssCRLF),
    options: [{ indent: 'tab', baseIndent: 1 }],
    errors: [{ messageId: 'indent', line: 3 }, { messageId: 'indent', line: 7 }]
  },
  {
    code: style([
      '@import "../styles/layout";',
      '.book-stage {',
      '    --reading-book-top: max(',
      ...multilineValue,
      '      .reading-spread-flip {',
      '    :deep(.reading-flip-copy-left), // keep with selector',
      '          :deep(:is(.reading-flip-copy-right,',
      '            .fallback)),',
      '          #{selector(".other,.last")} {',
      '      width: 200%;',
      '          }',
      '  }',
      '}'
    ], scopedScss),
    output: style([
      '@import "../styles/layout";',
      '.book-stage {',
      '  --reading-book-top: max(',
      ...multilineValue,
      '  .reading-spread-flip {',
      '    :deep(.reading-flip-copy-left), // keep with selector',
      '    :deep(:is(.reading-flip-copy-right,',
      '            .fallback)),',
      '    #{selector(".other,.last")} {',
      '      width: 200%;',
      '    }',
      '  }',
      '}'
    ], scopedScss),
    errors: [4, 8, 10, 12, 14].map(line => ({ messageId: 'indent', line }))
  },
  {
    code: style(['.first\\,', '  .descendant, /* separator */', '    .second[title="x,y"] {', '  color: red;', '}']),
    output: style(['.first\\,', '  .descendant, /* separator */', '.second[title="x,y"] {', '  color: red;', '}']),
    errors: [{ messageId: 'indent', line: 4 }]
  },
  {
    code: style(['.x', '    color red', '    &:hover', '        color blue'], stylus),
    output: style(['.x', '  color red', '  &:hover', '    color blue'], stylus),
    errors: [{ messageId: 'indent' }, { messageId: 'indent' }, { messageId: 'indent' }]
  }
])

testRule('css-declaration-empty-line', [
  { ...compact, options: ['always'] },
  invalidCss,
  {
    code: style(['.x {', '  color: red;', '  /* separate declaration groups */', '  display: block;', '  &:hover { color: blue; }', '  width: 2px;', '}'], { lang: 'scss' }),
    options: ['always']
  },
  {
    code: style(['.x {', '', '  color: red;', '', '  /* next group */', '', '  display: block;', '', '}'])
  },
  {
    code: style(['.x {', '  --top: max(', '', '      0px, 10px', '  );', '  display: block;', '}'])
  }
], [
  {
    code: style(['.x {', '  color: red; /* color */', '  ', '\t', '  display: block;', '}'], { eol: '\r\n' }),
    output: style(['.x {', '  color: red; /* color */', '  display: block;', '}'], { eol: '\r\n' }),
    errors: [{ messageId: 'unexpected', line: 4 }]
  },
  {
    code: style(['.x {', '  color: red; // color', '  display: block;', '}'], scssCRLF),
    output: style(['.x {', '  color: red; // color', '', '  display: block;', '}'], scssCRLF),
    options: ['always'],
    errors: [{ messageId: 'expected', line: 4 }]
  },
  {
    code: style(['.x', '  color red // color', '  display block'], stylus),
    output: style(['.x', '  color red // color', '', '  display block'], stylus),
    options: ['always'],
    errors: [{ messageId: 'expected', line: 4 }]
  }
])

it('enables sorting and two-space indentation for Vue files with the recommended config', () => {
  const linter = new Linter()
  const config = [
    { files: ['**/*.vue'], languageOptions: { parser: vueParser } },
    plugin.configs.recommended
  ]
  const input = style(['.x {', '    color: red;', '', '    display: block;', '}'], scopedScss)
  const diagnostics = linter.verify(input, config, 'component.vue')
  assert.deepEqual(diagnostics.map(({ ruleId, severity }) => [ruleId, severity]), [
    ['css-order/css-indent', 1],
    ['css-order/css-order', 1],
    ['css-order/css-indent', 1]
  ])
  const expected = style(['.x {', '  display: block;', '', '  color: red;', '}'], scopedScss)
  assert.equal(linter.verifyAndFix(input, config, 'component.vue').output, expected)
  assert.deepEqual(linter.verify('const css = ".x { color: red; display: block; }"', config, 'component.js'), [])
})

it('converges when all three Vue style rules are enabled', () => {
  const linter = new Linter()
  const config = [{
    ...plugin.configs.recommended,
    languageOptions: { parser: vueParser },
    rules: {
      ...plugin.configs.recommended.rules,
      'css-order/css-indent': ['error', { indent: 4 }],
      'css-order/css-declaration-empty-line': ['error', 'always']
    }
  }]
  const input = style([' .x {', ' color: red; // color', ' display: block;', ' }'], scssCRLF)
  const expected = style(['.x {', '    display: block;', '', '    color: red; // color', '}'], scssCRLF)
  const result = linter.verifyAndFix(input, config, 'component.vue')
  assert.equal(result.output, expected)
  assert.deepEqual(result.messages, [])
  assert.equal(linter.verifyAndFix(expected, config, 'component.vue').fixed, false)
})
