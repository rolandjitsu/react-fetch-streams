const camelCase = require('camelcase');
const babel = require('@rollup/plugin-babel').default;
const commonjs = require('@rollup/plugin-commonjs');
const {nodeResolve} = require('@rollup/plugin-node-resolve');
const sourcemaps = require('rollup-plugin-sourcemaps');
const {terser} = require('rollup-plugin-terser');

const pkg = require('./package.json');
const name = pkg.name;
const input = './src/index.js';

const plugins = [
  nodeResolve(),
  commonjs(),
  babel({babelHelpers: 'bundled'}),
  sourcemaps()
];

const deps = {
  react: 'React'
};

const output = {
  format: 'umd',
  name: camelCase(name),
  // The key here is library name, and the value is the the name of the global variable name the window object.
  // See https://github.com/rollup/rollup/wiki/JavaScript-API#globals for more.
  globals: deps,
  sourcemap: true
};

// List of dependencies
// See https://github.com/rollup/rollup/wiki/JavaScript-API#external for more.
const external = Object.keys(deps);

module.exports = [
  {
    input,
    plugins,
    external,
    output: {
      ...output,
      file: pkg.main
    }
  },
  {
    input,
    plugins: [...plugins, terser()],
    external,
    output: {
      ...output,
      file: addMin(pkg.main)
    }
  }
];

/**
 * Makes path.ext -> path.min.ext
 * @param {string} path
 */
function addMin(path) {
  const parts = path.split('.');
  const idx = parts.length - 1;
  const ext = parts[idx];
  parts.splice(idx, 1, 'min', ext);
  return parts.join('.');
}
