import {defineConfig} from 'tsdown';

const shared = {
  entry: ['src/index.ts'],
  platform: 'browser',
  target: 'es2019',
  sourcemap: true
};

export default defineConfig([
  // ESM (import) + CommonJS (require) for bundlers and Node, with declarations.
  {
    ...shared,
    format: ['es', 'cjs'],
    dts: true
  },
  // Minified UMD for CDN/<script> usage; exposes the `reactFetchStreams` global.
  {
    ...shared,
    format: ['umd'],
    dts: false,
    globalName: 'reactFetchStreams',
    minify: true,
    outputOptions: {
      entryFileNames: '[name].min.js',
      globals: {react: 'React'}
    }
  }
]);
