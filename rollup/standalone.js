// Rollup plugins
import commonjs from "rollup-plugin-commonjs";
import svelte from 'rollup-plugin-svelte';
import postcss from 'rollup-plugin-postcss';
import resolve from "rollup-plugin-node-resolve";

export default {
  input: 'src/standalone/order.js',
  output: {
    name: 'notOrder',
    format: 'iife',
    file: 'dist/notOrder.js',
    sourcemap: false,
  },
  plugins: [
    svelte({
      emitCss: true
    }),
    resolve({
      browser: true,
      dedupe: importee => importee === 'svelte' || importee.startsWith('svelte/')
    }),
    commonjs(),
    postcss({
      extract: true,
      minimize: true,
      use: [
        ['sass', {
          includePaths: [
            './src/standalone/theme',
            './node_modules'
          ]
        }]
      ]
    })
  ]
};
