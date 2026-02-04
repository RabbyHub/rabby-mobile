/// <reference types="nativewind/types" />
/// <reference path="./assets/assets.d.ts" />
/// <reference path="./types/token.d.ts" />

// keey sync with .env* files at the package's root
declare module '@env' {
  declare const Env: {
    RABBY_MOBILE_KR_PWD: string;
    RABBY_MOBILE_BUILD_CHANNEL: string;
    RABBY_MOBILE_SAFE_API_KEY: string;
    RABBY_MOBILE_CODE: string;
    DEV_CONSOLE_URL: string;
    DEV_SERVER_HOSTNAME?: string;

    RABBY_MOBILE_FE_SERVICE_URL?: string;
  };

  export = Env;
}

declare module 'json-rpc-middleware-stream';

// https://github.com/MetaMask/eth-json-rpc-filters
declare module 'eth-json-rpc-filters';
declare module 'eth-json-rpc-filters/subscriptionManager';

// https://github.com/MetaMask/eth-json-rpc-middleware
declare module 'eth-json-rpc-middleware';
declare module 'eth-json-rpc-middleware/providerAsMiddleware';

type RNViewProps = {
  style?: import('react').ComponentProps<
    typeof import('react-native').View
  >['style'];
  className?: string;
};

declare module '*.webview.injected.ts' {
  const content: string;
  export default content;
}

// Explicit path alias declaration for innerDapp (TS doesn't match wildcards via aliases)
declare module '@/core/bridges/builtInScripts/innerDapp.webview.injected' {
  const content: string;
  export default content;
}
declare module '*.webview.injected.tsx' {
  const content: string;
  export default content;
}
declare module '*.webview.injected.js' {
  const content: string;
  export default content;
}
