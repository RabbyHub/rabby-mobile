import { bindLedgerEvents } from '@/utils/ledger';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import BleTransport from '@ledgerhq/react-native-hw-transport-ble';
export async function initLedgerKeyring() {
  return getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring, keyring => {
    bindLedgerEvents(keyring);
  });
}

export async function connectLedger() {
  try {
    // const keyring = await getKeyring<LedgerKeyring>(KEYRING_TYPE.LedgerKeyring);

    const res = BleTransport.create();
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
