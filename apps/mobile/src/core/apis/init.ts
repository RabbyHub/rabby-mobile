import { initLedgerKeyring } from './ledger';
import { initOneKeyKeyring } from './onekey';
import { initWalletConnectKeyring } from './walletconnect';

// 绑定，当密码输入后
export async function initApis() {
  return Promise.all([
    initWalletConnectKeyring(),
    initLedgerKeyring(),
    initOneKeyKeyring(),
  ]);
}
