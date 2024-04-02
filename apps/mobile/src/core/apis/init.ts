import { initLedgerKeyring } from './ledger';
import { initOneKeyKeyring } from './onekey';
import { initWalletConnectKeyring } from './walletconnect';

export async function initApis() {
  return Promise.all([
    initWalletConnectKeyring(),
    initLedgerKeyring(),
    initOneKeyKeyring(),
  ]);
}
