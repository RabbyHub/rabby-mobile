import { CHAINS_ENUM } from '@/constant/chains';
import type { Account } from '@/types/account';
import { findChain } from '@/utils/chain';
import {
  accountToCaip10,
  getUnsupportedMethodsFromProposal,
  getWalletConnectChainByCaip2,
  getWalletConnectSupportedChains,
} from './chainAccount';

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
      getUnsupportedMethodsFromProposal({
        requiredNamespaces: {
          eip155: {
            methods: ['eth_sign', 'personal_sign'],
          },
        },
      }),
    ).toEqual(['eth_sign']);
  });
});
