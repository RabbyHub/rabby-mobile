// export const INITIAL_OPENAPI_URL = 'https://api.rabby.io';
export const INITIAL_OPENAPI_URL = 'https://app-api.rabby.io';

export const INITIAL_TESTNET_OPENAPI_URL = 'https://api.testnet.rabby.io';

// TODO: 确定一个合适的值
export const INTERNAL_REQUEST_ORIGIN = 'rabby-mobile';

export const INTERNAL_REQUEST_SESSION = {
  name: 'Rabby',
  origin: INTERNAL_REQUEST_ORIGIN,
  icon: './images/rabby-site-logo.png',
};

export enum CANCEL_TX_TYPE {
  QUICK_CANCEL = 'QUICK_CANCEL',
  ON_CHAIN_CANCEL = 'ON_CHAIN_CANCEL',
}
