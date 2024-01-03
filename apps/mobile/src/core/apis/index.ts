import { initWalletConnectKeyring } from './walletconnect';

export * as apisBoot from './boot';
export * as apisAddress from './address';
export * as apisWalletConnect from './walletconnect';
export * as apiBalance from './balance';
export * as apiSecurityEngine from './securityEngine';

export function initApis() {
  initWalletConnectKeyring();
}
