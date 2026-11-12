# Sort css styles (`css-order/css-order`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

对 Vue 单文件组件内的 CSS、SCSS 和 Stylus 声明按指定顺序排序。修复保留原始换行、缩进、空行和声明值，行尾注释随声明移动。

## 示例

```vue
<style lang="scss">
.card {
  color: red; // 文本颜色
  display: block;
}
</style>
```

自动修复后。

```vue
<style lang="scss">
.card {
  display: block;
  color: red; // 文本颜色
}
</style>
```

## Options

`propertyGroups` 接受属性名数组。配置优先级依次为 ESLint 规则选项、ESLint 工作目录下的 `css-order.config.json`、内置顺序。

## 排序边界

独立注释、嵌套块、`@include` 和未配置的声明会划分排序范围。规则保留可能相互覆盖的声明顺序。如果移动行尾 `//` 注释会覆盖同一行上的其他代码，该段声明会保留原有顺序。
