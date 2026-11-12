# Enforce indentation in Vue style blocks (`css-order/css-indent`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

检查 Vue 单文件组件中从新行开始的选择器、声明、注释、at-rule 和右花括号。修复只调整这些位置前的缩进。选择器、声明值和注释内部的续行保留原样。

## Options

```js
'css-order/css-indent': ['warn', { indent: 2, baseIndent: 0 }]
```

- `indent` 是每级缩进的空格数，也可以设为 `'tab'`。默认是 `2`。
- `baseIndent` 是顶层样式从行首计算的缩进级数。默认是 `0`。

CSS、SCSS 和 Stylus 均可检查。Stylus 的缩进参与语法解析，只有修复前后的解析结构一致时才提供自动修复。
