import { eventBus, EVENTS } from '@/utils/events';
import { KeyringInstance } from '@rabby-wallet/service-keyring';

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
      redirect: {
        native: 'rabbymobile://',
      },
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
