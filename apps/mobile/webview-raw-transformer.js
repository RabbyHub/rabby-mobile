// const upstream = require('@react-native/metro-babel-transformer');
const upstream = require('react-native-svg-transformer/react-native');

const babel = require('@babel/core');

function escapeForTemplateLiteral(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

module.exports.transform = function ({ src, filename, options }) {
  // 只处理你约定的后缀：.webview.ts / .webview.tsx / .webview.js
  if (
    filename.endsWith('.webview.injected.ts') ||
    filename.endsWith('.webview.injected.tsx')
  ) {
    // 用 Babel preset-typescript 擦除类型（不做 typecheck）
    const out = babel.transformSync(src, {
      filename,
      presets: [require.resolve('@babel/preset-typescript')],
      babelrc: false,
      configFile: false,
    });

    const js = out?.code ?? '';
    const wrapped = `export default \`${escapeForTemplateLiteral(js)}\`;`;

    return upstream.transform({ src: wrapped, filename, options });
  }

  if (filename.endsWith('.webview.js')) {
    const wrapped = `export default \`${escapeForTemplateLiteral(src)}\`;`;
    return upstream.transform({ src: wrapped, filename, options });
  }

  // 其他文件走默认处理
  return upstream.transform({ src, filename, options });
};
