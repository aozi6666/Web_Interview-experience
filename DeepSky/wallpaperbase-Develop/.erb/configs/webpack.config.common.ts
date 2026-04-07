import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import webpackPaths from './webpack.paths';

// 窗口配置类型定义
interface WindowConfig {
  name: string;
  entryPath: string;
  templatePath: string;
  filename: string;
}

// 多窗口配置
const windowConfigs: WindowConfig[] = [
  {
    name: 'main',
    entryPath: path.join(webpackPaths.srcRendererPath, 'index.tsx'),
    templatePath: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
    filename: 'index.html',
  },
  {
    name: 'video',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Video/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Video/index.ejs',
    ),
    filename: 'video.html',
  },
  {
    name: 'werenderer',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/WERenderer/index.ts',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/WERenderer/index.ejs',
    ),
    filename: 'werenderer.html',
  },
  {
    name: 'login',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Login/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Login/index.ejs',
    ),
    filename: 'login.html',
  },
  {
    name: 'live',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Live/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Live/index.ejs',
    ),
    filename: 'live.html',
  },
  {
    name: 'generateface',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/GenerateFace/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/GenerateFace/index.ejs',
    ),
    filename: 'generateface.html',
  },
  {
    name: 'preview',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Preview/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Preview/index.ejs',
    ),
    filename: 'preview.html',
  },
  {
    name: 'wallpaperinput',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/WallpaperInput/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/WallpaperInput/index.ejs',
    ),
    filename: 'wallpaperinput.html',
  },
  {
    name: 'floatingball',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/FloatingBall/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/FloatingBall/index.ejs',
    ),
    filename: 'floatingball.html',
  },
  {
    name: 'officialwallpaper',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/OfficialWallpaper/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/OfficialWallpaper/index.ejs',
    ),
    filename: 'officialwallpaper.html',
  },
  {
    name: 'createscene',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/CreateScene/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/CreateScene/index.ejs',
    ),
    filename: 'createscene.html',
  },
  {
    name: 'creationcenter',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/CreationCenter/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/CreationCenter/index.ejs',
    ),
    filename: 'creationcenter.html',
  },
  {
    name: 'alertdialog',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/AlertDialog/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/AlertDialog/index.ejs',
    ),
    filename: 'alertdialog.html',
  },
  {
    name: 'updateue',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/UpdateUE/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/UpdateUE/index.ejs',
    ),
    filename: 'updateue.html',
  },
  {
    name: 'settings',
    entryPath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Settings/index.tsx',
    ),
    templatePath: path.join(
      webpackPaths.srcRendererPath,
      'Windows/Settings/index.ejs',
    ),
    filename: 'settings.html',
  },
];

// 生成多窗口Entry配置
export function generateMultiWindowEntries(isDevelopment = false, port = 1212) {
  const entries: Record<string, string | string[]> = {};

  windowConfigs.forEach((config) => {
    if (isDevelopment) {
      entries[config.name] = [
        `webpack-dev-server/client?http://localhost:${port}/dist`,
        'webpack/hot/only-dev-server',
        config.entryPath,
      ];
    } else {
      entries[config.name] = config.entryPath;
    }
  });

  return entries;
}

// 生成多窗口HTML插件配置
export function generateMultiWindowHtmlPlugins(options: {
  isDevelopment?: boolean;
  nodeModules?: string;
  env?: string;
}) {
  const { isDevelopment = false, nodeModules, env } = options;

  return windowConfigs.map((config) => {
    const baseConfig = {
      filename: config.filename,
      template: config.templatePath,
      chunks: [config.name],
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
    };

    // 开发环境额外配置
    if (isDevelopment) {
      return new HtmlWebpackPlugin({
        ...baseConfig,
        env: env || 'development',
        isDevelopment,
        nodeModules,
      });
    }

    // 生产环境配置
    return new HtmlWebpackPlugin({
      ...baseConfig,
      isDevelopment: false,
    });
  });
}

export { windowConfigs };
