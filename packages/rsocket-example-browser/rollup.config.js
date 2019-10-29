import visualizer from 'rollup-plugin-visualizer';
import pkg from './package.json';

export default {
  input: 'src/browser.js',
  output: [
    {
      file: pkg.module,
      format: 'es',
    },
  ],
  plugins: [
    visualizer({
      filename: 'report.html',
    }),
  ],
};
