module.exports = {
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "auto",
  "overrides": [
    {
      "files": ".prettierrc",
      "options": {
        "parser": "json"
      }
    },
    {
      "files": ".less",
      "options": {
        "parser": "css"
      }
    }
  ]
}
