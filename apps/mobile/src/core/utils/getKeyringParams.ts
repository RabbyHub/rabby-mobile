import { KeyringTypeName, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';

export function getKeyringParams(type: KeyringTypeName) {
  if (type === KEYRING_TYPE.LedgerKeyring) {
    return {
      getTransport: deviceId => TransportBLE.open(deviceId),
      transportType: 'ble',
    };
  } else if (type === KEYRING_TYPE.SimpleKeyring) {
    return undefined;
  }

  return {};
}
