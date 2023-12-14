import { eventBus, EVENTS } from '@/utils/events';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { keyringService } from '../services';
import { getKeyring } from './keyring';

export function bindWalletConnectEvents(keyring: KeyringInstance) {
  keyring.on('statusChange', (data: any) => {
    console.log('statusChange', data);
    eventBus.emit(EVENTS.WALLETCONNECT.STATUS_CHANGED, data);
  });
  keyring.on('sessionStatusChange', (data: any) => {
    console.log('sessionStatusChange', data);
    eventBus.emit(EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED, data);
  });
  keyring.on('sessionAccountChange', (data: any) => {
    console.log('sessionAccountChange', data);
    eventBus.emit(EVENTS.WALLETCONNECT.SESSION_ACCOUNT_CHANGED, data);
  });
}

export function initWalletConnectKeyring() {
  getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
    keyring => {
      bindWalletConnectEvents(keyring);
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

export async function importAddress({
  address,
  brandName,
  realBrandName,
  realBrandUrl,
  deepLink,
}: {
  address: string;
  brandName: string;
  deepLink: string;
  realBrandName?: string;
  realBrandUrl?: string;
}) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  keyring.setAccountToAdd({
    address,
    brandName,
    realBrandName,
    realBrandUrl,
    deepLink,
  });

  await keyringService.addNewAccount(keyring as any);
  return;
}
