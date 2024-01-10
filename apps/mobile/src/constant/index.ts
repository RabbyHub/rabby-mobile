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

export const GAS_TOP_UP_ADDRESS = '0x7559e1bbe06e94aeed8000d5671ed424397d25b5';
export const GAS_TOP_UP_PAY_ADDRESS =
  '0x1f1f2bf8942861e6194fda1c0a9f13921c0cf117';

export const ALIAS_ADDRESS = {
  [GAS_TOP_UP_ADDRESS]: 'Gas Top Up',
  [GAS_TOP_UP_PAY_ADDRESS]: 'Gas Top Up',
};
