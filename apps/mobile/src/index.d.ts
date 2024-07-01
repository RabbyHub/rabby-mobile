/// <reference types="nativewind/types" />
/// <reference path="./assets/assets.d.ts" />

// keey sync with .env* files at the package's root
declare module '@env' {
  declare const Env: {
    RABBY_MOBILE_KR_PWD: string;
    RABBY_MOBILE_CODE: string;
    DEV_CONSOLE_URL: string;
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
