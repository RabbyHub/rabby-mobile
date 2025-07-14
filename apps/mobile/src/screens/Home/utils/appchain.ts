import {
  AppChainItem,
  ComplexProtocol,
} from '@rabby-wallet/rabby-api/dist/types';

export const APP_CHAIN_PREFIX = 'RABBY_APP_CHAIN_';

export const makeAppChainFromId = (appId: string) => {
  return `${APP_CHAIN_PREFIX}${appId}`;
};

export const isAppChain = (chain: string) => {
  return chain.startsWith(APP_CHAIN_PREFIX);
};

export const formatAppChain = (app: AppChainItem): ComplexProtocol => {
  return {
    ...app,
    chain: makeAppChainFromId(app.id),
    has_supported_portfolio: true,
    tvl: 0,
  };
};
