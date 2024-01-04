import { initWalletConnectKeyring } from './walletconnect';

export async function initApis() {
  return Promise.all([initWalletConnectKeyring()]);
}
