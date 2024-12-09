import { initLedgerKeyring } from './ledger';
import { initOneKeyKeyring } from './onekey';

export async function initApis() {
  return Promise.all([initLedgerKeyring(), initOneKeyKeyring()]);
}
