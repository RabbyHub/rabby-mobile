/// <reference types="nativewind/types" />
/// <reference path="./assets/assets.d.ts" />

// keey sync with .env* files at the package's root
declare module '@env' {
  declare const Env: {
    RABBY_MOBILE_KR_PWD: string;
    BUILD_CHANNEL: 'development' | 'regression' | 'production';
    DEV_CONSOLE_URL: string;
  };

  export = Env;
}
