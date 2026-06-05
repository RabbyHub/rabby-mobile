export const WALLETCONNECT_METADATA = {
  name: 'Rabby Mobile',
  description: 'Rabby Mobile WalletConnect wallet.',
  url: 'https://rabby.io',
  icons: ['https://rabby.io/assets/images/logo-128.png'],
  redirect: {
    native: 'rabby://walletconnect',
  },
};

export const WALLETCONNECT_SUPPORTED_METHODS = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'net_version',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
];

export const WALLETCONNECT_SUPPORTED_EVENTS = [
  'accountsChanged',
  'chainChanged',
];

export const WALLETCONNECT_NAMESPACE = 'eip155';
export const WALLETCONNECT_LOG_LIMIT = 80;

export const WalletConnectAutoDisconnect = true;
export const WALLETCONNECT_AUTO_DISCONNECT_INACTIVE_MS = 60 * 60 * 1000;
