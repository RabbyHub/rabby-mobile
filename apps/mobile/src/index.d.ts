/// <reference types="nativewind/types" />
/// <reference path="./assets/assets.d.ts" />
/// <reference path="./types/token.d.ts" />

// keey sync with .env* files at the package's root
declare module '@env' {
  declare const Env: {
    RABBY_MOBILE_KR_PWD: string;
    RABBY_MOBILE_BUILD_CHANNEL: string;
    RABBY_MOBILE_CODE: string;
    RABBY_MOBILE_E2E_SILENT_LOGS?: string;
    DEV_CONSOLE_URL: string;
    DEV_SERVER_HOSTNAME?: string;

    RABBY_MOBILE_FE_SERVICE_URL?: string;
    RABBY_MOBILE_WALLETCONNECT_PROJECT_ID?: string;
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
  testID?: import('react').ComponentProps<
    typeof import('react-native').View
  >['testID'];
  accessibilityLabel?: import('react').ComponentProps<
    typeof import('react-native').View
  >['accessibilityLabel'];
  accessible?: import('react').ComponentProps<
    typeof import('react-native').View
  >['accessible'];
};

type RabbyDevToolsBridgeMethodName =
  | 'ping'
  | 'getHomePortfolioSnapshot'
  | 'getSingleHomeSnapshot'
  | 'openSendScreen'
  | 'getSendScreenSnapshot'
  | 'clearWhitelistData'
  | 'setSendAmount';

interface RabbyDevToolsBridge {
  listMethods(): RabbyDevToolsBridgeMethodName[];
  hasMethod(name: string): boolean;
  invoke(name: string, ...args: unknown[]): Promise<unknown>;
  ping(): unknown;
  getHomePortfolioSnapshot(): unknown;
  getSingleHomeSnapshot(): unknown;
  openSendScreen(input: unknown): unknown;
  getSendScreenSnapshot(): unknown;
  clearWhitelistData(): unknown;
  setSendAmount(amount: unknown): unknown;
}

declare var __RABBY_DEVTOOLS_BRIDGE__: RabbyDevToolsBridge | undefined;

interface GlobalThis {
  __RABBY_DEVTOOLS_BRIDGE__?: RabbyDevToolsBridge;
}

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
