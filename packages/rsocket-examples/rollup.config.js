var flow = require('rollup-plugin-flow');

export default {
  entry: 'src/browser.js',
  dest: 'bundle.js',
  format: 'umd',
  sourceMap: 'inline',
  globals:'test',
  plugins: [ flow() ]
};
