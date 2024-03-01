import { initLedgerKeyring } from './ledger';
import { initWalletConnectKeyring } from './walletconnect';

export async function initApis() {
  return Promise.all([initWalletConnectKeyring(), initLedgerKeyring()]);
}
