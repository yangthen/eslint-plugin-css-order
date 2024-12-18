# eslint-plugin-css-order

目前仅支持 vue <style></style>标签内的样式排序

建议 vscode 安装插件 ESlint，并开启保存自动格式化：

设置 -> 搜索 format on save -> Editor: Format On Save Mode， 选择 file -> Editor: Format On Save， 勾选

配置文件中添加：
```json
...
"editor.codeActionsOnSave": {
  "source.fixAll.eslint": "explicit"
}
...
```
feature：支持自定义排序导入

feature：支持.css .scss .styl文件格式化

## Installation

```sh
npm i eslint-plugin-css-order --save-dev
```

## Usage

```js
import cssOrder from "eslint-plugin-css-order";

export default [
  {
    plugins: {
      'css-order': cssOrder
    },
    rules: {
      'css-order/css-order': 'error'
    }
  }
];
```
