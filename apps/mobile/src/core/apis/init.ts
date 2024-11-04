import { initLedgerKeyring } from './ledger';
import { initOneKeyKeyring } from './onekey';
import { initWalletConnectKeyring } from './walletconnect';

// TODO 初始化在 unlock 之后
export async function initApis() {
  return Promise.all([
    initWalletConnectKeyring(),
    initLedgerKeyring(),
    initOneKeyKeyring(),
  ]);
}
