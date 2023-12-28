const path = require('path');

/* eslint-disable import/no-extraneous-dependencies */
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

const {
  override,
  overrideDevServer,
  fixBabelImports,
  addExternalBabelPlugins,
  getBabelLoader,
  addLessLoader,
  adjustStyleLoaders,
  addWebpackAlias,
  addWebpackExternals,
  removeModuleScopePlugin,

  addBundleVisualizer,
  addWebpackPlugin,
} = require('customize-cra');

const rewireReactHotLoader = require('react-app-rewire-hot-loader');
const rewireStyledComponents = require("react-app-rewire-styled-components");

// const StyleLintPlugin = require('stylelint-webpack-plugin');
const eslintConfig = require('./.eslintrc.js');

const getBabelImportPluginOpts = () => {
  return {
    'antd': {
      libraryName: 'antd',
      libraryDirectory: 'es',
      // use .less
      style: true,
    },
    'antd-mobile': {
      libraryName: 'antd-mobile',
      libraryDirectory: 'es/components',
      // use .less
      style: false,
    }
  }
};

const styledComponents = obj => config => {
  config = rewireStyledComponents(config, process.env.NODE_ENV, obj);
  return config;
};

/**
 * 使用eslint
 * @param configRules
 * @returns {function(*): *}
 */
 const useEslintConfig = configRules => config => {
  const updatedRules = config.module.rules.map(rule => {
    // Only target rules that have defined a `useEslintrc` parameter in their options
    if (rule.use && rule.use.some(use => use.options && use.options.useEslintrc !== void 0)) {
      const ruleUse = rule.use[0];
      const baseOptions = ruleUse.options;
      const baseConfig = baseOptions.baseConfig || {};
      const newOptions = {
        useEslintrc: false,
        ignore: true,
        baseConfig: { ...baseConfig, ...configRules },
      };
      ruleUse.options = newOptions;
      return rule;

      // Rule not using eslint. Do not modify.
    } else {
      return rule;
    }
  });

  config.module.rules = updatedRules;
  return config;
};

module.exports = override(
  fixBabelImports('antd', getBabelImportPluginOpts()['antd']),
  addWebpackAlias({
    ['@']: path.resolve(__dirname, 'src')
  }),
  (config, env) => {
    config = rewireReactHotLoader(config, env);
    return config;
  },
  ...addExternalBabelPlugins(
    ["babel-plugin-import", getBabelImportPluginOpts(true)['antd'], 'antd-ext'],
  ),
  styledComponents({
    displayName: (process.env.NODE_ENV !== "production")
  }),
  addLessLoader({
    lessOptions: {
      javascriptEnabled: true,
      /**
       * @reference https://github.com/ant-design/ant-design/blob/master/components/style/themes/default.less
       */
      modifyVars: {
        // '@primary-color': 'rgba(112, 132, 255, 1)',
      },
    },
  }),
  // https://github.com/arackaf/customize-cra/issues/315#issuecomment-1017081592
  adjustStyleLoaders(({ use: [, , postcss] }) => {
    const postcssOptions = postcss.options;
    postcss.options = { postcssOptions };
  }),
  useEslintConfig(eslintConfig),
  (config) => {
    // Remove the ModuleScopePlugin which throws when we try to import something
    // outside of src/.
    config.resolve.plugins.pop();

    // Resolve the path aliases.
    config.resolve.plugins.push(new TsconfigPathsPlugin());

    // Let Babel compile outside of src/.
    const oneOfRule = config.module.rules.find((rule) => rule.oneOf);
    const tsRule = oneOfRule.oneOf.find((rule) =>
      rule.test.toString().includes("ts|tsx")
    );
    tsRule.include = undefined;
    tsRule.exclude = /node_modules/;

    return config;
  }
);
