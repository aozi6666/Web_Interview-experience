import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import 'webpack-dev-server';
import { merge } from 'webpack-merge';
import checkNodeEnv from '../scripts/check-node-env';
import baseConfig from './webpack.config.base';
import {
  generateMultiWindowEntries,
  generateMultiWindowHtmlPlugins,
} from './webpack.config.common';
import webpackPaths from './webpack.paths';

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

const port = Number(process.env.PORT) || 1212;
const manifest = path.resolve(webpackPaths.dllPath, 'renderer.json');
const skipDLLs =
  module.parent?.filename.includes('webpack.config.renderer.dev.dll') ||
  module.parent?.filename.includes('webpack.config.eslint');

/**
 * Warn if the DLL is not built
 */
if (
  !skipDLLs &&
  !(fs.existsSync(webpackPaths.dllPath) && fs.existsSync(manifest))
) {
  console.log(
    chalk.black.bgYellow.bold(
      'The DLL files are missing. Sit back while we build them for you with "npm run build-dll"',
    ),
  );
  execSync('npm run postinstall');
}

const configuration: webpack.Configuration = {
  devtool: 'cheap-module-source-map',

  mode: 'development',

  cache: {
    type: 'memory',
  },

  target: ['web', 'electron-renderer'],

  externals: {
    'opus-encdec': 'commonjs opus-encdec',
  },

  entry: generateMultiWindowEntries(true, port),

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
    filename: '[name].dev.js',
    globalObject: 'globalThis',
    library: {
      type: 'umd',
    },
  },

  module: {
    noParse: /opus-encdec\/dist\/(libopus-decoder|libopus-encoder)\.js/,
    rules: [
      {
        test: /\.s?(c|a)ss$/,
        use: [
          'style-loader',
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
        test: /\.s?css$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
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
  plugins: [
    ...(skipDLLs
      ? []
      : [
          new webpack.DllReferencePlugin({
            context: webpackPaths.dllPath,
            manifest: require(manifest),
            sourceType: 'var',
          }),
        ]),

    new webpack.NoEmitOnErrorsPlugin(),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),

    new ReactRefreshWebpackPlugin(),

    // 多窗口HTML插件
    ...generateMultiWindowHtmlPlugins({
      isDevelopment: true,
      nodeModules: webpackPaths.appNodeModulesPath,
      env: process.env.NODE_ENV,
    }),

    // Ignore critical dependency warnings for opus-encdec
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/libopus-(decoder|encoder)$/,
      contextRegExp: /opus-encdec\/dist$/,
    }),

    // Additional plugin to suppress all opus-encdec warnings
    new webpack.ContextReplacementPlugin(/opus-encdec\/dist$/, (data: any) => {
      if (data.dependencies && data.dependencies.length > 0) {
        data.dependencies.forEach((dep: any) => {
          if (dep.critical) {
            delete dep.critical;
          }
        });
      }
      return data;
    }),
  ],

  node: {
    __dirname: false,
    __filename: false,
  },

  devServer: {
    port,
    compress: true,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval' blob:",
    },
    static: [
      {
        directory: path.resolve(webpackPaths.rootPath, 'public'),
        publicPath: '/',
      },
    ],
    historyApiFallback: {
      verbose: true,
    },
    // Suppress webpack warnings in the browser console
    client: {
      logging: 'error',
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    setupMiddlewares(middlewares) {
      console.log('Starting preload.js builder...');
      const preloadProcess = spawn('npm', ['run', 'start:preload'], {
        shell: true,
        stdio: 'inherit',
      })
        .on('close', (code: number) => process.exit(code!))
        .on('error', (spawnError) => console.error(spawnError));

      console.log('Starting Main Process...');
      let args = ['run', 'start:main'];
      if (process.env.MAIN_ARGS) {
        args = args.concat(
          ['--', ...process.env.MAIN_ARGS.matchAll(/"[^"]+"|[^\s"]+/g)].flat(),
        );
      }
      spawn('npm', args, {
        shell: true,
        stdio: 'inherit',
      })
        .on('close', (code: number) => {
          preloadProcess.kill();
          process.exit(code!);
        })
        .on('error', (spawnError) => console.error(spawnError));
      return middlewares;
    },
  },
};

export default merge(baseConfig, configuration);
