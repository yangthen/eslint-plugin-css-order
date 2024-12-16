/**
 * @fileoverview sort css styles
 * @author yangthen
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const rule = require("../../../lib/rules/eslint-plugin-css-order"),
  RuleTester = require("eslint").RuleTester;


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester();
ruleTester.run("eslint-plugin-css-order", rule, {
  valid: [
    { code: "css`a { display: flex; flex: 1; }`" },
    { code: "css`display: flex; flex: 1;`" }
  ],
  invalid: [
    {
      code: "css`a { flex: 1; display: flex; }`",
      errors: [
        {
          messageId: "cssOrderError",
        },
      ],
      output: "css`a { display: flex; flex: 1; }`"
    },
    {
      code: "css`flex: 1; display: flex;`",
      errors: [
        {
          messageId: "cssOrderError",
        },
      ],
      output: "css`display: flex;flex: 1;`"
    }
  ]
})
