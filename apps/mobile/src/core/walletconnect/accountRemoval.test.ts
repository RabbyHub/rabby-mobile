import type { Account } from '@/types/account';
import { disconnectWalletConnectSessionsForRemovedAccount } from './accountRemoval';
import { clearWalletConnectAutoDisconnectTopic } from './autoDisconnect';
import {
  forgetWalletConnectAccountForTopic,
  getWalletConnectAccountForTopic,
} from './accountSelection';
import { getWalletConnectClient } from './client';
import { addWalletConnectLog } from './debugLog';
import {
  getWalletConnectApprovedAddresses,
  syncWalletConnectSessionsFromClient,
} from './sessions';

jest.mock('@walletconnect/utils', () => ({
  getSdkError: jest.fn((key: string) => ({
    code: 5000,
    message: key,
  })),
}));

jest.mock('./autoDisconnect', () => ({
  clearWalletConnectAutoDisconnectTopic: jest.fn(),
}));

jest.mock('./accountSelection', () => ({
  forgetWalletConnectAccountForTopic: jest.fn(),
  getWalletConnectAccountForTopic: jest.fn(),
  isSameWalletConnectAccount: jest.fn(
    (
      account: Pick<Account, 'address' | 'type' | 'brandName'>,
      target?: Pick<Account, 'address' | 'type' | 'brandName'> | null,
    ) =>
      !!target &&
      account.address.toLowerCase() === target.address.toLowerCase() &&
      account.type === target.type &&
      account.brandName === target.brandName,
  ),
}));

jest.mock('./client', () => ({
  getWalletConnectClient: jest.fn(),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./sessions', () => ({
  getWalletConnectApprovedAddresses: jest.fn(),
  syncWalletConnectSessionsFromClient: jest.fn(),
}));

const removedAccount = {
  address: '0xAbCd00000000000000000000000000000000AbCd',
  type: 'Ledger Hardware',
  brandName: 'Ledger',
} as Account;

function createSession(topic: string) {
  return {
    topic,
  } as never;
}

describe('walletconnect account removal cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disconnects sessions that were approved with the removed account identity', async () => {
    const matchingSession = createSession('topic-1');
    const sameAddressDifferentTypeSession = createSession('topic-2');
    const walletKit = {
      getActiveSessions: jest.fn(() => ({
        'topic-1': matchingSession,
        'topic-2': sameAddressDifferentTypeSession,
      })),
      disconnectSession: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(getWalletConnectClient).mockReturnValue(walletKit as never);
    jest.mocked(getWalletConnectAccountForTopic).mockImplementation(topic => {
      if (topic === 'topic-1') {
        return {
          address: '0xabcd00000000000000000000000000000000abcd',
          type: 'Ledger Hardware',
          brandName: 'Ledger',
        };
      }
      return {
        address: '0xabcd00000000000000000000000000000000abcd',
        type: 'HD Key Tree',
        brandName: 'Rabby',
      };
    });

    await expect(
      disconnectWalletConnectSessionsForRemovedAccount(removedAccount),
    ).resolves.toBe(1);

    expect(clearWalletConnectAutoDisconnectTopic).toHaveBeenCalledWith(
      'topic-1',
    );
    expect(walletKit.disconnectSession).toHaveBeenCalledWith({
      topic: 'topic-1',
      reason: {
        code: 5000,
        message: 'USER_DISCONNECTED',
      },
    });
    expect(forgetWalletConnectAccountForTopic).toHaveBeenCalledWith('topic-1');
    expect(syncWalletConnectSessionsFromClient).toHaveBeenCalledWith(walletKit);
  });

  it('falls back to approved session addresses for sessions without stored account identity', async () => {
    const matchingSession = createSession('topic-1');
    const otherSession = createSession('topic-2');
    const walletKit = {
      getActiveSessions: jest.fn(() => ({
        'topic-1': matchingSession,
        'topic-2': otherSession,
      })),
      disconnectSession: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(getWalletConnectClient).mockReturnValue(walletKit as never);
    jest.mocked(getWalletConnectAccountForTopic).mockReturnValue(null);
    jest
      .mocked(getWalletConnectApprovedAddresses)
      .mockImplementation(session => {
        return session === matchingSession
          ? ['0xabcd00000000000000000000000000000000abcd']
          : ['0x2222222222222222222222222222222222222222'];
      });

    await expect(
      disconnectWalletConnectSessionsForRemovedAccount(removedAccount),
    ).resolves.toBe(1);

    expect(walletKit.disconnectSession).toHaveBeenCalledWith({
      topic: 'topic-1',
      reason: {
        code: 5000,
        message: 'USER_DISCONNECTED',
      },
    });
  });

  it('does nothing when WalletConnect is not initialized', async () => {
    jest.mocked(getWalletConnectClient).mockReturnValue(null);

    await expect(
      disconnectWalletConnectSessionsForRemovedAccount(removedAccount),
    ).resolves.toBe(0);

    expect(addWalletConnectLog).not.toHaveBeenCalled();
    expect(syncWalletConnectSessionsFromClient).not.toHaveBeenCalled();
  });
});
