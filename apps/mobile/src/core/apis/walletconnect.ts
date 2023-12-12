import { eventBus, EVENTS } from '@/utils/events';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKeyring } from './keyring';

export function initWalletConnectKeyring() {
  getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
    keyring => {
      keyring.on('statusChange', (data: any) => {
        eventBus.emit(EVENTS.WALLETCONNECT.STATUS_CHANGED, data);
      });
      keyring.on('sessionStatusChange', (data: any) => {
        eventBus.emit(EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED, data);
      });
      keyring.on('sessionAccountChange', (data: any) => {
        eventBus.emit(EVENTS.WALLETCONNECT.SESSION_ACCOUNT_CHANGED, data);
      });
    },
  );
}

export async function getUri(brandName: string) {
  let uri: string | undefined;

  try {
    const keyring = await getKeyring<WalletConnectKeyring>(
      KEYRING_TYPE.WalletConnectKeyring,
    );

    const res = await keyring.initConnector(brandName);
    uri = res.uri;
  } catch (e) {
    console.error(e);
  }

  return uri;
}
