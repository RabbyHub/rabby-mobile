import type { Account } from '@/types/account';
import {
  approveWalletConnectProposal,
  rejectWalletConnectProposal,
} from './index';
import { getWalletConnectClientOrThrow } from './client';
import {
  buildApprovedNamespacesForAccount,
  clearWalletConnectProposal,
  getWalletConnectPendingProposal,
} from './proposal';
import { clearWalletConnectProposalPairingState } from './state';
import { syncWalletConnectSessionsFromClient } from './sessions';
import { replaceWalletConnectSessionsForAutoDisconnect } from './autoDisconnect';
import { maybeRedirectToDapp } from './redirectPolicy';

const walletKit = {
  approveSession: jest.fn(),
  rejectSession: jest.fn(),
};

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
} as Account;

jest.mock('@walletconnect/utils', () => ({
  getSdkError: jest.fn((key: string) => ({
    code: 5000,
    message: key,
  })),
}));

jest.mock('./autoDisconnect', () => ({
  clearWalletConnectAutoDisconnectTopic: jest.fn(),
  replaceWalletConnectSessionsForAutoDisconnect: jest.fn(),
}));

jest.mock('./chainAccount', () => ({
  getWalletConnectAccounts: jest.fn(),
  getWalletConnectChainByCaip2: jest.fn(),
  getWalletConnectSupportedChains: jest.fn(),
}));

jest.mock('./client', () => ({
  getWalletConnectClientOrThrow: jest.fn(),
  initWalletConnect: jest.fn(),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./error', () => ({
  getWalletConnectErrorMessage: jest.fn((error: Error) => error.message),
}));

jest.mock('./pairing', () => ({
  pairWalletConnectUri: jest.fn(),
}));

jest.mock('./proposal', () => ({
  buildApprovedNamespacesForAccount: jest.fn(),
  clearWalletConnectProposal: jest.fn(),
  getWalletConnectPendingProposal: jest.fn(),
  setWalletConnectProposalError: jest.fn(),
}));

jest.mock('./redirectPolicy', () => ({
  maybeRedirectToDapp: jest.fn(),
  shouldAutoRedirectToDapp: jest.fn(),
}));

jest.mock('./sessions', () => ({
  syncWalletConnectSessionsFromClient: jest.fn(),
}));

jest.mock('./state', () => ({
  clearWalletConnectProposalPairingState: jest.fn(),
  getWalletConnectDebugState: jest.fn(),
  subscribeWalletConnectDebugState: jest.fn(),
}));

jest.mock('./uri', () => ({
  isWalletConnectUri: jest.fn(),
  parseWalletConnectUri: jest.fn(),
  parseWalletConnectUriFromLink: jest.fn(),
  WalletConnectUriError: class WalletConnectUriError extends Error {},
}));

describe('walletconnect proposal lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(getWalletConnectClientOrThrow)
      .mockReturnValue(walletKit as never);
    jest.mocked(getWalletConnectPendingProposal).mockReturnValue({
      id: 1,
      source: 'qr',
      proposal: {
        requiredNamespaces: {},
        optionalNamespaces: {},
      },
    } as never);
    jest.mocked(buildApprovedNamespacesForAccount).mockReturnValue({
      eip155: {
        chains: ['eip155:1'],
        accounts: ['eip155:1:0x1111111111111111111111111111111111111111'],
        methods: ['personal_sign'],
        events: ['accountsChanged', 'chainChanged'],
      },
    });
    walletKit.approveSession.mockResolvedValue({
      topic: 'topic-1',
      peer: {
        metadata: {},
      },
    });
    walletKit.rejectSession.mockResolvedValue(undefined);
  });

  it('clears proposal pairing state after approving a proposal', async () => {
    await approveWalletConnectProposal({
      proposalId: 1,
      account,
      fallbackChain: 'ETH' as never,
    });

    expect(buildApprovedNamespacesForAccount).toHaveBeenCalledWith({
      proposal: {
        requiredNamespaces: {},
        optionalNamespaces: {},
      },
      account,
      fallbackChain: 'ETH',
    });
    expect(clearWalletConnectProposal).toHaveBeenCalledWith(1);
    expect(clearWalletConnectProposalPairingState).toHaveBeenCalledTimes(1);
    expect(replaceWalletConnectSessionsForAutoDisconnect).toHaveBeenCalledWith(
      walletKit,
      'topic-1',
    );
    expect(syncWalletConnectSessionsFromClient).toHaveBeenCalledWith(walletKit);
    expect(maybeRedirectToDapp).toHaveBeenCalledWith({
      source: 'qr',
      nativeRedirect: undefined,
    });
  });

  it('clears proposal pairing state after rejecting a proposal', async () => {
    await rejectWalletConnectProposal(1);

    expect(clearWalletConnectProposal).toHaveBeenCalledWith(1);
    expect(clearWalletConnectProposalPairingState).toHaveBeenCalledTimes(1);
  });
});
