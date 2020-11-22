const presets = [];

if (process.env['BABEL_ENV'] === 'es') {
  presets.push(['@babel/preset-env', {modules: false}]);
} else {
  presets.push('@babel/preset-env');
}

module.exports = {
  presets,
  env: {
    test: {
      presets,
      plugins: ['@babel/plugin-transform-runtime']
    }
  }
};
