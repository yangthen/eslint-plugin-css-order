/**
 * @fileoverview sort css styles
 * @author yangthen
 */
"use strict";

import cssOrder from './rules/eslint-plugin-css-order.js'

export default {
  rules: { 'css-order': cssOrder },
  // plugins: {'css-order': cssOrder},
  // configs: {
  //   recommended: {
  //     plugins: {'css-order': cssOrder},
  //     rules: {
  //       'css-order/css-order': 'error'
  //     }
  //   }
  // }
}



