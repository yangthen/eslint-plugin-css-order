# eslint-plugin-css-order

目前仅支持 vue <style></style>标签内的样式排序，.css .scss .styl 文件格式化需官方 @eslint/css 开发完成

建议 vscode 安装插件 ESlint，并开启保存自动格式化：

设置 -> 搜索 format on save -> Editor: Format On Save Mode， 选择 file

勾选 Editor:Format On Save

配置文件中添加：
```json
"editor.formatOnSave": false,
"editor.codeActionsOnSave": {
  "source.fixAll.eslint": "explicit",
  "source.organizeImports": "never"
}
```

## 安装

```sh
npm i eslint-plugin-css-order --save-dev
```

## 使用

```js
import cssOrder from "eslint-plugin-css-order";

export default [
  {
    plugins: {
      'css-order': cssOrder
    },
    rules: {
      'css-order/css-order': 'warn'
    }
  }
];
```

## 配置文件示例

支持自定义排序配置 css-order.config.json，如无此文件则使用默认排序规则

```json
[
  "content",
  "position",
  "top",
  "bottom",
  "right",
  "left",
  ...
]
```
