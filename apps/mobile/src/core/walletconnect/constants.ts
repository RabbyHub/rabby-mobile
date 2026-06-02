import { SAFE_RPC_METHODS } from '@/constant/rpc';

export const WALLETCONNECT_METADATA = {
  name: 'Rabby Mobile Test WalletConnect',
  description: 'DEV-only WalletConnect wallet surface for Rabby Mobile.',
  url: 'https://rabby.io',
  icons: ['https://rabby.io/assets/images/logo-128.png'],
  redirect: {
    native: 'rabby://walletconnect',
  },
};

const SAFE_ETH_READ_METHODS = SAFE_RPC_METHODS.filter(
  method =>
    method.startsWith('eth_') &&
    ![
      'eth_decrypt',
      'eth_getEncryptionPublicKey',
      'eth_sendRawTransaction',
      'eth_sendTransaction',
    ].includes(method),
);

export const WALLETCONNECT_SUPPORTED_METHODS = Array.from(
  new Set([
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',
    'net_version',
    ...SAFE_ETH_READ_METHODS,
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4',
    'eth_sendTransaction',
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
    'wallet_watchAsset',
  ]),
);

export const WALLETCONNECT_SUPPORTED_EVENTS = [
  'accountsChanged',
  'chainChanged',
];

export const WALLETCONNECT_NAMESPACE = 'eip155';
export const WALLETCONNECT_LOG_LIMIT = 80;
