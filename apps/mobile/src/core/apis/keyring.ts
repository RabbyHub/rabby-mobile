import { KeyringTypeName, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { keyringService } from '../services';

const GET_WALLETCONNECT_CONFIG = () => {
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
