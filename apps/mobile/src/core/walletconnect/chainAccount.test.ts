import { CHAINS_ENUM } from '@/constant/chains';
import type { Account } from '@/types/account';
import { findChain } from '@/utils/chain';
import {
  accountToCaip10,
  getUnsupportedRequiredMethodsFromProposal,
  getWalletConnectChainByCaip2,
  getWalletConnectSupportedChains,
} from './chainAccount';
import { WALLETCONNECT_SUPPORTED_METHODS } from './constants';

jest.mock('@/constant/chains', () => {
  const CHAINS_ENUM = {
    ETH: 'ETH',
  };
  return {
    CHAINS_ENUM,
    getChainList: () => [
      {
        enum: CHAINS_ENUM.ETH,
        id: 1,
        serverId: 'eth',
        hex: '0x1',
        network: '1',
      },
    ],
  };
});

jest.mock('@/utils/chain', () => ({
  findChain: ({ enum: chainEnum, id }: { enum?: string; id?: number }) => {
    const eth = {
      enum: 'ETH',
      id: 1,
      serverId: 'eth',
      hex: '0x1',
      network: '1',
    };
    if (chainEnum === eth.enum || id === eth.id) {
      return eth;
    }
    return null;
  },
}));

describe('walletconnect chain account mapping', () => {
  it('maps Rabby chains and accounts into CAIP identifiers', () => {
    const eth = findChain({ enum: CHAINS_ENUM.ETH })!;
    const account = {
      address: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    } as Account;

    expect(getWalletConnectSupportedChains()).toContain(`eip155:${eth.id}`);
    expect(accountToCaip10(account, eth)).toBe(
      `eip155:${eth.id}:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`,
    );
    expect(getWalletConnectChainByCaip2(`eip155:${eth.id}`)?.enum).toBe(
      CHAINS_ENUM.ETH,
    );
  });

  it('does not advertise unsupported methods', () => {
    expect(
      getUnsupportedRequiredMethodsFromProposal({
        requiredNamespaces: {
          eip155: {
            methods: [
              'eth_sign',
              'personal_sign',
              'eth_getLogs',
              'wallet_watchAsset',
              'wallet_addEthereumChain',
            ],
          },
        },
      }),
    ).toEqual(['eth_sign', 'wallet_addEthereumChain']);
  });

  it('does not block unsupported optional methods', () => {
    expect(
      getUnsupportedRequiredMethodsFromProposal({
        requiredNamespaces: {
          eip155: {
            methods: ['personal_sign'],
          },
        },
        optionalNamespaces: {
          eip155: {
            methods: ['eth_sign'],
          },
        },
      }),
    ).toEqual([]);
  });

  it('advertises only WalletConnect methods handled by the bridge', () => {
    expect(WALLETCONNECT_SUPPORTED_METHODS).toEqual([
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
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v3',
      'eth_signTypedData_v4',
      'eth_sendTransaction',
    ]);
  });
});
