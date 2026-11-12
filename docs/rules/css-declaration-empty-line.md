# Enforce empty lines between declarations in Vue style blocks (`css-order/css-declaration-empty-line`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

检查 Vue 单文件组件中同一块内、分行书写的连续声明之间的空行。行尾注释归属前一条声明，独立注释和嵌套块会分隔声明组。同一行上的声明以及多行属性值内部的空行保留原样。

## Options

```js
'css-order/css-declaration-empty-line': ['warn', 'never']
```

- `'never'` 删除连续声明之间的空行。这是默认值。
- `'always'` 要求连续声明之间至少有一行空行。

自动修复保留原有换行符。Stylus 的修复需要通过解析结构检查。
