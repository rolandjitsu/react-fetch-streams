import {defineConfig} from 'tsdown';

const shared = {
  entry: ['src/index.js'],
  platform: 'browser',
  target: 'es2019',
  sourcemap: true,
  // Types are hand-written in ./typings, not generated from source.
  dts: false
};

export default defineConfig([
  // ESM (import) + CommonJS (require) for bundlers and Node.
  {
    ...shared,
    format: ['es', 'cjs']
  },
  // Minified UMD for CDN/<script> usage; exposes the `reactFetchStreams` global.
  {
    ...shared,
    format: ['umd'],
    globalName: 'reactFetchStreams',
    minify: true,
    outputOptions: {
      entryFileNames: '[name].min.js',
      globals: {react: 'React'}
    }
  }
]);
