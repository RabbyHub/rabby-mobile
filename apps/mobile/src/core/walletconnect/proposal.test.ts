import type { Account } from '@/types/account';
import {
  buildApprovedNamespacesForAccount,
  storeWalletConnectProposal,
} from './proposal';

const mockCaptureException = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./state', () => ({
  setWalletConnectDebugState: jest.fn(),
}));

jest.mock('./uiEvents', () => ({
  emitWalletConnectUiEvent: jest.fn(),
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
  beforeEach(() => {
    mockCaptureException.mockClear();
  });

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

  it('tolerates unsupported required methods and reports their source', () => {
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'Simple Key Pair',
      brandName: 'Rabby',
    } as Account;
    const proposal = {
      proposer: {
        metadata: {
          name: 'Example dapp',
          description: '',
          url: 'https://example.com/connect?token=secret',
          icons: [],
          redirect: {
            native: 'example://walletconnect?token=secret',
          },
        },
      },
      requiredNamespaces: {
        eip155: {
          chains: ['eip155:1'],
          methods: [
            'personal_sign',
            'wallet_addEthereumChain',
            'dapp_nonstandardMethod',
          ],
          events: ['accountsChanged'],
        },
      },
      optionalNamespaces: {},
    };

    storeWalletConnectProposal({
      id: 1,
      proposal,
      source: 'deeplink',
    });
    const namespaces = buildApprovedNamespacesForAccount({
      account,
      proposal,
    });

    expect(namespaces.eip155.methods).toEqual(
      expect.arrayContaining([
        'wallet_addEthereumChain',
        'dapp_nonstandardMethod',
      ]),
    );
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unsupported WalletConnect required methods tolerated',
      }),
      {
        tags: {
          scene: 'walletconnect_proposal',
          source: 'deeplink',
        },
        extra: {
          dappName: 'Example dapp',
          dappOrigin: 'https://example.com',
          appScheme: 'example:',
          methods: ['wallet_addEthereumChain', 'dapp_nonstandardMethod'],
        },
      },
    );
  });

  it('falls back to the selected chain for chainless optional eip155 proposals', () => {
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'Simple Key Pair',
      brandName: 'Rabby',
    } as Account;
    const namespaces = buildApprovedNamespacesForAccount({
      account,
      fallbackChain: 'ETH' as never,
      proposal: {
        requiredNamespaces: {},
        optionalNamespaces: {
          eip155: {
            methods: ['personal_sign', 'wallet_switchEthereumChain'],
            events: ['accountsChanged', 'chainChanged'],
          },
        },
      },
    });

    expect(namespaces).toEqual({
      eip155: {
        chains: ['eip155:1'],
        methods: ['personal_sign', 'wallet_switchEthereumChain'],
        events: ['accountsChanged', 'chainChanged'],
        accounts: ['eip155:1:0x1111111111111111111111111111111111111111'],
      },
    });
  });

  it('falls back to the selected chain when optional eip155 has no supported chains', () => {
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'Simple Key Pair',
      brandName: 'Rabby',
    } as Account;
    const namespaces = buildApprovedNamespacesForAccount({
      account,
      fallbackChain: 'ETH' as never,
      proposal: {
        requiredNamespaces: {},
        optionalNamespaces: {
          eip155: {
            chains: ['eip155:0'],
            methods: [
              'eth_sendRawTransaction',
              'eth_signTransaction',
              'eth_sendTransaction',
              'personal_sign',
              'wallet_switchEthereumChain',
            ],
            events: ['accountsChanged', 'chainChanged', 'disconnect'],
          },
        },
      },
    });

    expect(namespaces).toEqual({
      eip155: {
        chains: ['eip155:1'],
        methods: [
          'eth_sendTransaction',
          'personal_sign',
          'wallet_switchEthereumChain',
        ],
        events: ['accountsChanged', 'chainChanged'],
        accounts: ['eip155:1:0x1111111111111111111111111111111111111111'],
      },
    });
  });

  it('does not approve empty namespaces without a selected-chain fallback', () => {
    const account = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'Simple Key Pair',
      brandName: 'Rabby',
    } as Account;

    expect(() =>
      buildApprovedNamespacesForAccount({
        account,
        proposal: {
          requiredNamespaces: {},
          optionalNamespaces: {
            eip155: {
              methods: ['personal_sign'],
              events: ['accountsChanged'],
            },
          },
        },
      }),
    ).toThrow('No supported WalletConnect namespace to approve.');
  });
});
