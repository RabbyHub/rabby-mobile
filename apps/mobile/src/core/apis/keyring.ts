import { KeyringTypeName, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { keyringService } from '../services';
import { ethErrors } from 'eth-rpc-errors';

export const GET_WALLETCONNECT_CONFIG = () => {
  return {
    // 1h
    maxDuration: 3600000,
    clientMeta: {
      description: 'The game-changing wallet for Ethereum and all EVM chains',
      url: 'https://rabby.io',
      icons: [
        'https://static-assets.rabby.io/files/122da969-da58-42e9-ab39-0a8dd38d94b8.png',
      ],
      name: 'Rabby',
    },
    projectId: 'ed21a1293590bdc995404dff7e033f04',
    v2Whitelist: [
      'AMBER',
      'Zerion',
      'Bitget',
      'TP',
      'WALLETCONNECT',
      'WalletConnect',
      'FIREBLOCKS',
      'MPCVault',
      'MetaMask',
      'Rainbow',
      'imToken',
      'MATHWALLET',
      'TRUSTWALLET',
    ],
  };
};

export async function getKeyring<T = KeyringInstance>(
  type: KeyringTypeName,
  callbackOnNewKeyring?: (keyring: KeyringInstance) => void,
): Promise<T> {
  let keyring = keyringService.getKeyringByType(type) as any as KeyringInstance;
  let isNewKey = false;

  if (!keyring) {
    const Keyring = keyringService.getKeyringClassForType(type);
    keyring = new Keyring(
      type === KEYRING_TYPE.WalletConnectKeyring
        ? GET_WALLETCONNECT_CONFIG()
        : undefined,
    );
    isNewKey = true;
  }

  if (isNewKey) {
    await keyringService.addKeyring(keyring);
    callbackOnNewKeyring?.(keyring);
  }

  return keyring as T;
}

const stashKeyrings: Record<string | number, any> = {};

function _getKeyringByType(type: KeyringTypeName) {
  const keyring = keyringService.getKeyringsByType(type)[0];

  if (keyring) {
    return keyring;
  }

  throw ethErrors.rpc.internal(`No ${type} keyring found`);
}

export function requestKeyring(
  type: KeyringTypeName,
  methodName: string,
  keyringId: number | null,
  ...params: any[]
) {
  let keyring: any;
  if (keyringId !== null && keyringId !== undefined) {
    keyring = stashKeyrings[keyringId];
  } else {
    try {
      keyring = _getKeyringByType(type);
    } catch {
      const Keyring = keyringService.getKeyringClassForType(type);
      keyring = new Keyring();
    }
  }
  if (keyring[methodName]) {
    return keyring[methodName].call(keyring, ...params);
  }
}
