module.exports = {
    presets: [
        ['@babel/preset-env', {
            // 浏览器兼容版本
            targets: {
                edge: '17',
                firefox: '60',
                chrome: '67',
                safari: '11.1',
                ie: '11'
            },
            // 按需导入
            useBuiltIns: 'usage',
            // 指定 core-js 版本
            corejs: '3.46.0',
            // 指定模块类型
            modules: false,
        }]
    ],
    // plugins: [
    //     '@babel/plugin-transform-optional-chaining'
    // ]
}