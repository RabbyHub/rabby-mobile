/// <reference types="vite/client" />

/// <reference path="./types/duplex.d.ts" />

declare const __PLATFORM__: 'ios' | 'android';
declare const ReactNativeWebView: {
  injectedObjectJson: () => string;
  postMessage: (message: string) => void;
};

interface Window {
  ReactNativeWebView: typeof ReactNativeWebView;
  onMessageFromReactNative: {
    (message: DuplexReceive): void;
  };
}
