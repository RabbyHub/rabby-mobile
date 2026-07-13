import { KeyringTypeName, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getLedgerDmkSession } from '@/core/keyring-bridge/ledger/ledger-dmk';

export function getKeyringParams(type: KeyringTypeName) {
  if (type === KEYRING_TYPE.LedgerKeyring) {
    return {
      getLedgerSession: getLedgerDmkSession,
      transportType: 'ble',
    };
  } else if (type === KEYRING_TYPE.SimpleKeyring) {
    return undefined;
  }

  return {};
}
