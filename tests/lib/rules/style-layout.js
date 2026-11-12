import assert from 'node:assert/strict'
import { Linter, RuleTester } from 'eslint'
import { it } from 'mocha'
import vueParser from 'vue-eslint-parser'
import plugin, { rules } from '../../../lib/index.js'

const tester = new RuleTester({ languageOptions: { parser: vueParser } })

function style (lines, { lang = 'css', eol = '\n' } = {}) {
  const opening = lang === 'css' ? '<style>' : '<style lang="' + lang + '">'
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

it('converges when all three Vue style rules are enabled', () => {
  const linter = new Linter()
  const config = [{
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser },
    plugins: { 'css-order': plugin },
    rules: {
      'css-order/css-order': 'error',
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
