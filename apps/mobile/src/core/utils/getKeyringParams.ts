import { KeyringTypeName, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { GET_WALLETCONNECT_CONFIG } from '../../utils/wc';
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';

export function getKeyringParams(type: KeyringTypeName) {
  if (type === KEYRING_TYPE.WalletConnectKeyring) {
    return GET_WALLETCONNECT_CONFIG();
  } else if (type === KEYRING_TYPE.LedgerKeyring) {
    return {
      getTransport: deviceId => TransportBLE.open(deviceId),
      transportType: 'ble',
    };
  }

  return {};
}
