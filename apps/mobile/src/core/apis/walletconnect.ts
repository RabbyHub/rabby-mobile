import { eventBus, EVENTS } from '@/utils/events';
import { CHAINS_LIST } from '@debank/common';
import { WalletConnectKeyring } from '@rabby-wallet/eth-walletconnect-keyring';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { keyringService } from '../services';
import { Account } from '../services/preference';
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

const allChainIds = CHAINS_LIST.map(
  chain => !chain.isTestnet && chain.id,
).filter(Boolean) as number[];

export async function initWalletConnectKeyring() {
  return getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
    keyring => {
      bindWalletConnectEvents(keyring);
    },
  );
}

export async function getUri(
  brandName: string,
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

    const res = await keyring.initConnector(brandName, allChainIds, account);
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

export async function walletConnectSwitchChain(
  account: Account,
  chainId: number,
) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  try {
    if (keyring) {
      await keyring.switchEthereumChain(account.brandName, chainId);
    }
  } catch (e) {
    console.log('walletconnect error', e);
  }

  return;
}

export async function getWalletConnectStatus(
  address: string,
  brandName: string,
) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  if (keyring) {
    return keyring.getConnectorStatus(address, brandName);
  }
  return;
}

export async function resendWalletConnect(account: Account) {
  const keyring = await getKeyring<WalletConnectKeyring>(
    KEYRING_TYPE.WalletConnectKeyring,
  );

  if (keyring) {
    return keyring.resend(account);
  }
  return;
}
