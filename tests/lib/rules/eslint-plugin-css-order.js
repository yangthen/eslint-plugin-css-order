import { RuleTester } from 'eslint'
import vueParser from 'vue-eslint-parser'
import rule from '../../../lib/rules/eslint-plugin-css-order.js'

const ruleTester = new RuleTester({
  languageOptions: { parser: vueParser }
})

function style (body, lang = 'css') {
  const opening = lang === 'css' ? '<style>' : '<style lang="' + lang + '">'
  return opening + body + '</style>'
}

const multilineCustomProperties = [
  '  --reading-page-radius: #{reading-size(14)};',
  '    --reading-book-top: max(',
  '      calc(var(--reading-back-top) + var(--reading-back-size) + #{reading-size(10)}),',
  '      calc((100dvh - #{reading-size(775)}) / 2 + #{reading-size(7)})',
  '  );'
]

const multilineBackground = [
  '  background: linear-gradient(',
  '    // keep with value',
  '    #{reading-color(14)}, blue',
  '  ); // keep with background'
]

const cascadeConflicts = [
  ['mask: none', '-webkit-mask-box-image-source: url(mask.svg)', 'mask', '-webkit-mask-box-image-source'],
  ['border: 0', 'border-image-source: url(border.svg)', 'border', 'border-image-source'],
  ['font: 16px serif', 'font-feature-settings: "kern" 0', 'font', 'font-feature-settings'],
  ['font-width: condensed', 'font-stretch: expanded', 'font-width', 'font-stretch'],
  ['animation: fade 1s', 'animation-range-start: entry', 'animation', 'animation-range-start'],
  ['white-space: normal', 'text-wrap: nowrap', 'white-space', 'text-wrap'],
  ['border-color: blue', 'border-inline-start: 1px solid red', 'border-color', 'border-inline-start'],
  ['border-radius: 0', 'border-start-start-radius: 8px', 'border-radius', 'border-start-start-radius'],
  ['background-position-x: left', 'background-position-inline: center', 'background-position-x', 'background-position-inline'],
  ['grid-gap: 1rem', 'row-gap: 0', 'grid-gap', 'row-gap'],
  ['page-break-before: always', 'break-before: avoid', 'page-break-before', 'break-before'],
  ['all: unset', 'display: grid', 'all', 'display']
]

const invalid = [
  ...['\n', '\r\n'].map(eol => ({
    code: style(['', '.x {', '  color: red;', '  display: block;', '}', ''].join(eol)),
    output: style(['', '.x {', '  display: block;', '  color: red;', '}', ''].join(eol)),
    errors: [{ messageId: 'cssSort', line: 3, column: 3, endColumn: 8 }]
  })),
  {
    code: style('.x {\r\n  color: red;\r\n  display: block\r\n}'),
    output: style('.x {\r\n  display: block;\r\n  color: red\r\n}'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { color: red; /* color: intent */ display: block /* display */ }'),
    output: style('.x { display: block; /* display */ color: red /* color: intent */ }'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('\n.x {\n  color: red; // color\n  display: block // display\n}\n', 'scss'),
    output: style('\n.x {\n  display: block; // display\n  color: red // color\n}\n', 'scss'),
    errors: [{ messageId: 'cssSort' }]
  },
  ...['\n', '\r\n'].map(eol => ({
    code: style(['', '.book {', '  color: var(--reading-back);', '  user-select: none;', '  // 666', '  cursor: pointer;', '}', ''].join(eol), 'scss'),
    output: style(['', '.book {', '  color: var(--reading-back);', '  // 666', '  cursor: pointer;', '  user-select: none;', '}', ''].join(eol), 'scss'),
    errors: [{ messageId: 'cssSort', line: 4, column: 3, endColumn: 14 }]
  })),
  {
    code: style('\n.x {\n  user-select: none; /* keep with user-select */\n  /* first note */\n  /* second note */ cursor: pointer\n}\n'),
    output: style('\n.x {\n  /* first note */\n  /* second note */ cursor: pointer;\n  user-select: none /* keep with user-select */\n}\n'),
    errors: [{ messageId: 'cssSort', line: 3, column: 3 }]
  },
  {
    code: style(['', '.book-stage {', ...multilineCustomProperties, '  color: red;', '  display: block;', '}', ''].join('\n'), 'scss'),
    output: style(['', '.book-stage {', ...multilineCustomProperties, '  display: block;', '  color: red;', '}', ''].join('\n'), 'scss'),
    errors: [{ messageId: 'cssSort', line: 8, column: 3 }]
  },
  {
    code: style(['', '.x {', ...multilineBackground, '  display: block;', '}', ''].join('\r\n'), 'scss'),
    output: style(['', '.x {', '  display: block;', ...multilineBackground, '}', ''].join('\r\n'), 'scss'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('\n.x {\n  /* section heading */\n  color: red;\n  padding: 0;\n\n  display: block;\n}\n'),
    output: style('\n.x {\n  /* section heading */\n  color: red;\n  display: block;\n\n  padding: 0;\n}\n'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { @include theme; &:hover { color: blue; display: block; } color: red; display: flex; }', 'scss'),
    output: style('.x { @include theme; &:hover { display: block; color: blue; } display: flex; color: red; }', 'scss'),
    errors: [{ messageId: 'cssSort' }, { messageId: 'cssSort' }]
  },
  {
    code: style('\n.x\n  color red // color;\n  display block\n', 'stylus'),
    output: style('\n.x\n  display block\n  color red // color;\n', 'stylus'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { color: red; display: -webkit-box; display: flex; }'),
    output: style('.x { display: -webkit-box; display: flex; color: red; }'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { margin-left: 10px; margin-top: 0; }'),
    output: style('.x { margin-top: 0; margin-left: 10px; }'),
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { all: unset; direction: rtl; --gap: 4px; }'),
    output: style('.x { direction: rtl; --gap: 4px; all: unset; }'),
    options: [{ propertyGroups: ['direction', '--gap', 'all'] }],
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { DISPLAY: block; color: red; }'),
    output: style('.x { color: red; DISPLAY: block; }'),
    options: [{ propertyGroups: ['color', 'display'] }],
    errors: [{ messageId: 'cssSort' }]
  },
  {
    code: style('.x { color: red\n display: block; }') + '\n' + style('.x { color: blue; display: block; }'),
    output: style('.x { color: red\n display: block; }') + '\n' + style('.x { display: block; color: blue; }'),
    errors: [{ messageId: 'cssSort', line: 3 }]
  }
]

ruleTester.run('css-order', rule, {
  valid: [
    { code: style(['', '.book-stage {', ...multilineCustomProperties, '}', ''].join('\n'), 'scss') },
    { code: style('.x { margin-left: 10px; margin: 0; }') },
    { code: style('.x { margin-inline: 0; margin-left: 10px; }') },
    { code: style('.x { color: red; @include theme; display: block; }', 'scss') },
    { code: style('.x { color: red; // keep with color\n display: block; }', 'scss') },
    { code: style('.x { color: red; display: block; }', 'less') },
    { code: style('.x { color: red; --theme: red; display: block; }') },
    { code: style('.x { color: red;\n  /* heading */\n  display: block; }') },
    { code: style('\n.x {\n  user-select: none;\n\n  /* section heading */\n  cursor: pointer;\n}\n') },
    { code: style('\n.x {\n  user-select: none;\n  /* detached comment */\n\n  cursor: pointer;\n}\n') },
    { code: style('\n.x {\n  user-select: none;\n  /* stylelint-disable-next-line declaration-property-value-allowed-list */\n  cursor: pointer;\n}\n') },
    ...cascadeConflicts.map(([first, second, firstName, secondName]) => ({
      code: style('.x { ' + first + '; ' + second + '; }'),
      options: [{ propertyGroups: [secondName, firstName] }]
    })),
    ...invalid.map(({ output, options = [] }) => ({ code: output, options }))
  ].map(test => ({ filename: 'component.vue', ...test })),
  invalid: invalid.map(test => ({ filename: 'component.vue', ...test }))
})
