# eslint-plugin-css-order

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
