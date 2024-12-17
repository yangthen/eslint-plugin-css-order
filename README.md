# eslint-plugin-css-order

目前仅支持 vue <style></style>标签内的样式排序

feature：支持自定义排序导入

feature：支持.css .scss .styl文件格式化

sort css styles

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
