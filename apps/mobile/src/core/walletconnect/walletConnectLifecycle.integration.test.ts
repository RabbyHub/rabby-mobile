import type { IWalletKit } from '@reown/walletkit';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';

import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import type { Account } from '@/types/account';
import {
  getWalletConnectAccountForTopic,
  rememberWalletConnectAccountForTopic,
} from './accountPersistence';
import {
  replaceWalletConnectSessionsForAutoDisconnect,
  setWalletConnectAutoDisconnectEnabled,
} from './autoDisconnect';
import {
  clearWalletConnectProposal,
  storeWalletConnectProposal,
} from './proposal';
import {
  getWalletConnectDebugState,
  setWalletConnectDebugState,
  subscribeWalletConnectDebugState,
} from './state';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
} as Account;

function makeSession(topic: string): SessionTypes.Struct {
  return {
    topic,
    namespaces: {
      eip155: {
        accounts: [`eip155:1:${account.address}`],
        chains: ['eip155:1'],
        methods: ['personal_sign'],
        events: ['accountsChanged'],
      },
    },
    peer: {
      publicKey: `${topic}-key`,
      metadata: {
        name: topic,
        description: '',
        url: `https://${topic}.example.com`,
        icons: [],
      },
    },
  } as SessionTypes.Struct;
}

function makeWalletKit(sessions: SessionTypes.Struct[]) {
  const activeSessions = Object.fromEntries(
    sessions.map(session => [session.topic, session]),
  );
  const disconnectedTopics: string[] = [];
  const walletKit = {
    getActiveSessions: () => activeSessions,
    disconnectSession: async ({ topic }: { topic: string }) => {
      disconnectedTopics.push(topic);
      delete activeSessions[topic];
    },
  } as unknown as IWalletKit;

  return { walletKit, disconnectedTopics };
}

describe('WalletConnect proposal, persistence, and session lifecycle integration', () => {
  it('publishes a proposal, replaces the old session, and preserves the active account mapping', async () => {
    jest.useFakeTimers();
    const oldSession = makeSession('old-topic');
    const activeSession = makeSession('active-topic');
    const { walletKit, disconnectedTopics } = makeWalletKit([
      oldSession,
      activeSession,
    ]);
    const observedProposalIds: Array<number | undefined> = [];
    const unsubscribe = subscribeWalletConnectDebugState(() => {
      observedProposalIds.push(getWalletConnectDebugState().proposal?.id);
    });

    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: { status: 'idle' },
      proposal: undefined,
      sessions: [],
      log: [],
    }));
    appStorage.removeItem(
      APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
    );
    appStorage.removeItem(APP_MMKV_WEAK_KEYS.WALLETCONNECT_SETTINGS);

    try {
      storeWalletConnectProposal({
        id: 42,
        source: 'qr',
        proposal: {
          id: 42,
          proposer: {
            publicKey: 'proposal-key',
            metadata: {
              name: 'Integration dapp',
              description: '',
              url: 'https://integration.example.com',
              icons: [],
            },
          },
          requiredNamespaces: {},
          optionalNamespaces: {},
        } as ProposalTypes.Struct,
      });
      expect(getWalletConnectDebugState().proposal?.id).toBe(42);

      rememberWalletConnectAccountForTopic(oldSession.topic, account);
      rememberWalletConnectAccountForTopic(activeSession.topic, account);
      setWalletConnectAutoDisconnectEnabled(true);

      await replaceWalletConnectSessionsForAutoDisconnect(
        walletKit,
        activeSession.topic,
      );

      expect(disconnectedTopics).toEqual([oldSession.topic]);
      expect(getWalletConnectAccountForTopic(oldSession.topic)).toBeNull();
      expect(getWalletConnectAccountForTopic(activeSession.topic)).toEqual(
        account,
      );
      expect(getWalletConnectDebugState().sessions).toEqual([
        expect.objectContaining({ topic: activeSession.topic }),
      ]);

      clearWalletConnectProposal(42);
      expect(getWalletConnectDebugState().proposal).toBeUndefined();
      expect(observedProposalIds).toContain(42);
      expect(observedProposalIds.at(-1)).toBeUndefined();
    } finally {
      setWalletConnectAutoDisconnectEnabled(false);
      clearWalletConnectProposal();
      appStorage.removeItem(
        APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
      );
      appStorage.removeItem(APP_MMKV_WEAK_KEYS.WALLETCONNECT_SETTINGS);
      unsubscribe();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
