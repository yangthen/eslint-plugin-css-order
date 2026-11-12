# eslint-plugin-css-order

支持 Vue 单文件组件中 `<style>`、`<style lang="scss">` 和 `<style lang="stylus">` 的属性排序。

在 VS Code 安装 ESLint 扩展后，可在 `settings.json` 中启用保存时自动修复。

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## 安装

```sh
npm i -D eslint-plugin-css-order vue-eslint-parser
```

## 使用

```js
import cssOrder from "eslint-plugin-css-order";
import vueParser from "vue-eslint-parser";

export default [
  {
    files: ["**/*.vue"],
    languageOptions: { parser: vueParser },
    plugins: {
      'css-order': cssOrder
    },
    rules: {
      'css-order/css-order': 'warn'
    }
  }
];
```

## 自定义排序

可以通过 ESLint 规则选项传入属性顺序。

```js
"css-order/css-order": ["warn", { propertyGroups: ["position", "display", "color"] }]
```

也可以在 ESLint 工作目录下创建 `css-order.config.json`。规则选项优先于该文件，两者均未配置时使用内置顺序。

```json
[
  "position",
  "display",
  "color"
]
```

`--fix` 保留换行、缩进、空行和多行属性值。行尾注释随声明移动，独立注释、嵌套块、`@include` 和未配置的属性构成排序边界。可能相互覆盖的声明保留原有顺序。

## 规则

<!-- begin auto-generated rules list -->

🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).

| Name                                 | Description     | 🔧 |
| :----------------------------------- | :-------------- | :- |
| [css-order](docs/rules/css-order.md) | sort css styles | 🔧 |

<!-- end auto-generated rules list -->
