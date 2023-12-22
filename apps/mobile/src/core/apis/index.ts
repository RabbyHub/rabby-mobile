import { initWalletConnectKeyring } from './walletconnect';

export * as apisBoot from './boot';
export * as apisAddress from './address';
export * as apisWalletConnect from './walletconnect';
export * as apiBalance from './balance';

export function initApis() {
  initWalletConnectKeyring();
}
