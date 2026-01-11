import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
  // UMD build (for CDN/script tag)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/idv.min.js',
      format: 'umd',
      name: 'IDV',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({ tsconfig: './tsconfig.json' }),
      production && terser(),
    ],
  },
  // ESM build (for bundlers)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/idv.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },
];
