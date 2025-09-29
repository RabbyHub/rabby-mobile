import { initLedgerKeyring } from './ledger';
import { initOneKeyKeyring } from './onekey';
import { initTrezorKeyring } from './trezor';

export async function initApis() {
  return Promise.all([
    initLedgerKeyring(),
    initOneKeyKeyring(),
    initTrezorKeyring(),
  ]);
}
