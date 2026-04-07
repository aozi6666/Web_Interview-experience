/**
 * Build config for electron renderer process
 */

import CopyWebpackPlugin from 'copy-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';
import baseConfig from './webpack.config.base';
import {
  generateMultiWindowEntries,
  generateMultiWindowHtmlPlugins,
} from './webpack.config.common';
import webpackPaths from './webpack.paths';

checkNodeEnv('production');
deleteSourceMaps();

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'production',

  target: ['web', 'electron-renderer'],

  externals: {
    'opus-encdec': 'commonjs opus-encdec',
  },

  entry: generateMultiWindowEntries(),

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: './',
    filename: '[name].js',
    globalObject: 'globalThis',
    library: {
      type: 'umd',
    },
  },

  module: {
    noParse: /opus-encdec\/dist\/(libopus-decoder|libopus-encoder)\.js/,
    rules: [
      {
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
            },
          },
          'sass-loader',
        ],
        include: /\.module\.s?(c|a)ss$/,
      },
      {
        test: /\.s?(a|c)ss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
        exclude: /\.module\.s?(c|a)ss$/,
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      // Images
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      // SVG
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              prettier: false,
              svgo: false,
              svgoConfig: {
                plugins: [{ removeViewBox: false }],
              },
              titleProp: true,
              ref: true,
            },
          },
          'file-loader',
        ],
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin(), new CssMinimizerPlugin()],
  },

  plugins: [
    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
    }),

    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
      analyzerPort: 8889,
    }),

    // 多窗口HTML插件
    ...generateMultiWindowHtmlPlugins({ isDevelopment: false }),

    new webpack.DefinePlugin({
      'process.type': '"renderer"',
    }),

    // 复制 public 目录到构建输出
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(webpackPaths.rootPath, 'public'),
          to: path.resolve(webpackPaths.distRendererPath),
        },
      ],
    }),

    // Ignore critical dependency warnings for opus-encdec
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/libopus-(decoder|encoder)$/,
      contextRegExp: /opus-encdec\/dist$/,
    }),

    // Additional plugin to suppress all opus-encdec warnings
    new webpack.ContextReplacementPlugin(/opus-encdec\/dist$/, (data) => {
      if (data.dependencies && data.dependencies.length > 0) {
        data.dependencies.forEach((dep) => {
          if (dep.critical) {
            delete dep.critical;
          }
        });
      }
      return data;
    }),
  ],
};

export default merge(baseConfig, configuration);
