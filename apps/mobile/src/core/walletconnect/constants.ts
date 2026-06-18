export const WALLETCONNECT_METADATA = {
  name: 'Rabby Mobile',
  description: 'Rabby Mobile WalletConnect wallet.',
  url: 'https://rabby.io',
  icons: ['https://rabby.io/assets/images/logo-128.png'],
  redirect: {
    native: 'rabby://walletconnect',
  },
};

export const WALLETCONNECT_SIGN_METHODS: string[] = [
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
];

export const WALLETCONNECT_SUPPORTED_METHODS: string[] = [
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'net_version',
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getBlockTransactionCountByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_getCode',
  'eth_getFilterChanges',
  'eth_getFilterLogs',
  'eth_getLogs',
  'eth_getProof',
  'eth_getStorageAt',
  'eth_getTransactionByBlockHashAndIndex',
  'eth_getTransactionByBlockNumberAndIndex',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_newBlockFilter',
  'eth_newFilter',
  'eth_newPendingTransactionFilter',
  'eth_syncing',
  'eth_uninstallFilter',
  'net_listening',
  'web3_clientVersion',
  'wallet_getPermissions',
  'wallet_requestPermissions',
  'wallet_watchAsset',
  'wallet_switchEthereumChain',
  ...WALLETCONNECT_SIGN_METHODS,
];

export const WALLETCONNECT_SUPPORTED_EVENTS = [
  'accountsChanged',
  'chainChanged',
];

export const WALLETCONNECT_NAMESPACE = 'eip155';
export const WALLETCONNECT_LOG_LIMIT = 80;

export const WalletConnectAutoDisconnect = true;
export const WALLETCONNECT_AUTO_DISCONNECT_DEFAULT_INACTIVE_MINUTES = 60;
