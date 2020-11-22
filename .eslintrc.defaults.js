module.exports = {
  parser: '@babel/eslint-parser',
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:prettier/recommended'
  ],
  rules: {
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        trailingComma: 'none',
        bracketSpacing: false,
        arrowParens: 'avoid'
      }
    ]
  },
  env: {
    browser: true,
    node: true,
    es2017: true,
    jest: true
  }
};
