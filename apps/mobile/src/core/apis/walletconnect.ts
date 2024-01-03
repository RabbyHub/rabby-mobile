import { eventBus, EVENTS } from '@/utils/events';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { keyringService } from '../services';
import { getKeyring } from './keyring';

export function bindWalletConnectEvents(keyring: KeyringInstance) {
  keyring.on('statusChange', (data: any) => {
    eventBus.emit(EVENTS.WALLETCONNECT.STATUS_CHANGED, data);
  });
  keyring.on('sessionStatusChange', (data: any) => {
    eventBus.emit(EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED, data);
  });
  keyring.on('sessionAccountChange', (data: any) => {
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

export async function getUri(
  brandName: string,
  chainId?: number,
  account?: {
    address: string;
    brandName: string;
  },
) {
  let uri: string | undefined;

  try {
    const keyring = await getKeyring<WalletConnectKeyring>(
      KEYRING_TYPE.WalletConnectKeyring,
    );

    const res = await keyring.initConnector(brandName, chainId, account);
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
}: {
  address: string;
  brandName: string;
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
  });

  await keyringService.addNewAccount(keyring as any);
  return;
}

export async function getDeepLink({
  address,
  brandName,
}: {
  address: string;
  brandName: string;
}) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  const session = keyring.getSessionAccount(address, brandName);

  return session?.deepLink;
}

export async function checkClientIsCreate(params: {
  address: string;
  brandName: string;
}) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  const isConnected = await keyring.checkClientIsCreate(params);

  return isConnected;
}

export async function getSessionStatus(address: string, brandName: string) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  return keyring.getSessionStatus(address, brandName);
}
export async function killWalletConnectConnector(
  address: string,
  brandName: string,
  silent?: boolean,
) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );
  if (keyring) {
    await keyring.closeConnector({ address, brandName }, silent);
  }
}

export async function getWalletConnectSessionAccount(
  address: string,
  brandName: string,
) {
  try {
    const keyring = await getKeyring<WalletConnectKeyring>(
      KEYRING_TYPE.WalletConnectKeyring,
    );
    if (keyring) {
      return keyring.getSessionAccount(address, brandName);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export async function getCommonWalletConnectInfo(address: string) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  if (keyring) {
    return keyring.getCommonWalletConnectInfo(address);
  }
  return;
}
