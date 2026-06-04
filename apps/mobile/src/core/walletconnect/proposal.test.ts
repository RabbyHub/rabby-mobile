import type { Account } from '@/types/account';
import { buildApprovedNamespacesForAccount } from './proposal';

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./state', () => ({
  setWalletConnectDebugState: jest.fn(),
}));

jest.mock('@/constant/chains', () => ({
  getChainList: () => [
    {
      enum: 'ETH',
      id: 1,
      serverId: 'eth',
      hex: '0x1',
      network: '1',
    },
  ],
}));

jest.mock('@/utils/chain', () => ({
  findChain: ({ id }: { id?: number }) =>
    id === 1
      ? {
          enum: 'ETH',
          id: 1,
          serverId: 'eth',
          hex: '0x1',
          network: '1',
        }
      : null,
}));

describe('walletconnect proposal approval', () => {
  it('builds approved eip155 namespaces for the selected account', () => {
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'Simple Key Pair',
      brandName: 'Rabby',
    } as Account;
    const namespaces = buildApprovedNamespacesForAccount({
      account,
      proposal: {
        requiredNamespaces: {
          eip155: {
            chains: ['eip155:1'],
            methods: ['personal_sign'],
            events: ['accountsChanged'],
          },
        },
        optionalNamespaces: {},
      },
    });

    expect(namespaces.eip155.methods).toContain('personal_sign');
    expect(namespaces.eip155.accounts).toContain(
      'eip155:1:0x1111111111111111111111111111111111111111',
    );
  });
});
