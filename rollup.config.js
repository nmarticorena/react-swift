import peerDepsExternal from "rollup-plugin-peer-deps-external";
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import url from '@rollup/plugin-url';
import postcss from 'rollup-plugin-postcss';


export default {
    input: 'src/index.ts',
    output: {
      dir: './dist',
      format: 'es',
      name: 'swift',
      exports: 'named',
      sourcemap: true,
    //   inlineDynamicImports: true
    },
    plugins: [
        peerDepsExternal(),
        commonjs(),
        typescript(),
        
        babel({
            exclude: "node_modules/**",
        }),
        url(),
        postcss({
            modules: true,
        }),
        nodeResolve()
      ],
  };