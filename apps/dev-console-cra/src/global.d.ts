/// <reference types="react-scripts" />
/// <reference types="@rabby-wallet/rn-webview-bridge" />


declare module '*.less';

declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface Window {
  vConsoleInst?: import('vconsole').VConsole;
}
