module.exports = {
  extends: 'erb',
  plugins: ['@typescript-eslint'],
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-import-module-exports': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'class-methods-use-this': 'off',
    // -----------------------------
    'react/function-component-definition': 'off', // 允许函数组件定义
    'jsx-a11y/click-events-have-key-events': 'off', // 允许点击事件有键盘事件
    'jsx-a11y/no-static-element-interactions': 'off', // 允许静态元素有交互事件
    // 导入顺序规则
    'import/order': 'off', // 禁用导入顺序检查
    'import/prefer-default-export': 'off', // 允许单个导出使用命名导出
    // 全局放宽规则（按当前项目需求）
    camelcase: 'off',
    'no-console': 'off',
    'max-classes-per-file': 'off',
    'no-underscore-dangle': 'off',
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['node_modules', 'src/'],
      },
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};
