export * from './browserScripts';

declare global {
  interface Window {
    ReactNativeWebView?: any;
  }
}

export { webviewInPagePostMessage } from './inPage';
