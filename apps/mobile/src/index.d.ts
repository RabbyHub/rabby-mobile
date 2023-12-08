/// <reference path="./assets/assets.d.ts" />

// keey sync with .env* files at the package's root
declare module "@env" {
  declare const Env: {
    RABBY_MOBILE_KR_PWD: string;
  }

  export = Env;
};
