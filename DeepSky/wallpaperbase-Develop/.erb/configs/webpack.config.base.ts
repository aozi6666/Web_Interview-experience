/**
 * Base webpack config used across other specific configs
 */

import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpack from 'webpack';
import { dependencies as externals } from '../../release/app/package.json';
import webpackPaths from './webpack.paths';

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',
  module: {
    noParse: /opus-encdec\/dist\/(libopus-decoder|libopus-encoder)\.js/,
    rules: [
      {
        // WE 引擎源码在浏览器窗口中必须按 ESM 输出，避免运行时出现 exports is not defined
        test: /\.[jt]sx?$/,
        include: /[\\/]src[\\/]we-engine[\\/]/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            configFile: `${webpackPaths.rootPath}/tsconfig.json`,
            compilerOptions: {
              module: 'esnext',
              moduleResolution: 'bundler',
            },
          },
        },
      },
      {
        test: /\.[jt]sx?$/,
        exclude: [/node_modules/, /[\\/]src[\\/]we-engine[\\/]/],
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            configFile: `${webpackPaths.rootPath}/tsconfig.json`,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
      {
        test: /\.node$/,
        loader: 'node-loader', // 需先安装：npm install node-loader
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: { type: 'commonjs2' },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
  },

  plugins: [new webpack.EnvironmentPlugin({ NODE_ENV: 'production' })],
};

export default configuration;
