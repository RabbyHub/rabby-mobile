import { getAllAccountsToDisplay } from '@/core/apis/account';
import type { IWalletKit } from '@reown/walletkit';
import type { SessionTypes } from '@walletconnect/types';
import { findChain } from '@/utils/chain';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  getAddressFromCaip10,
  getChainsFromNamespaces,
  getMethodsFromNamespaces,
} from './chainAccount';
import {
  getWalletConnectAccountForTopic,
  isSameWalletConnectAccount,
} from './accountSelection';
import { addWalletConnectLog } from './debugLog';
import { setWalletConnectDebugState } from './state';
import type { WalletConnectSessionViewModel } from './types';

function getMetadata(session: SessionTypes.Struct) {
  const metadata = session.peer?.metadata;
  return {
    name: metadata?.name || 'Unknown dapp',
    description: metadata?.description || '',
    url: metadata?.url || '',
    icons: Array.isArray(metadata?.icons) ? metadata.icons : [],
    redirectNative: metadata?.redirect?.native || '',
  };
}

export function getWalletConnectSessionOrigin(session: SessionTypes.Struct) {
  const metadata = getMetadata(session);
  return safeGetOrigin(metadata.url || '') || metadata.url || '';
}

function getApprovedAccounts(session: SessionTypes.Struct) {
  const accounts = new Set<string>();
  Object.values(session.namespaces || {}).forEach(namespace => {
    namespace?.accounts?.forEach((account: string) => {
      if (account) {
        accounts.add(account);
      }
    });
  });
  return Array.from(accounts);
}

export function getWalletConnectApprovedAddresses(
  session: SessionTypes.Struct,
) {
  return getApprovedAccounts(session).map(getAddressFromCaip10).filter(Boolean);
}

export function getWalletConnectApprovedChains(session: SessionTypes.Struct) {
  const chainsFromNamespaces = getChainsFromNamespaces(session.namespaces);
  if (chainsFromNamespaces.length) {
    return chainsFromNamespaces;
  }

  return getApprovedAccounts(session)
    .map(account => account.split(':').slice(0, 2).join(':'))
    .filter(Boolean);
}

export function buildWalletConnectSessionViewModel(
  session: SessionTypes.Struct,
): WalletConnectSessionViewModel {
  const selectedAddress = getWalletConnectApprovedAddresses(session)[0];
  return {
    topic: session.topic,
    peer: getMetadata(session),
    chains: getWalletConnectApprovedChains(session),
    methods: getMethodsFromNamespaces(session.namespaces),
    accounts: getApprovedAccounts(session),
    selectedAccount: selectedAddress
      ? {
          address: selectedAddress,
        }
      : undefined,
  };
}

export function syncWalletConnectSessionsFromClient(walletKit: IWalletKit) {
  const sessions = Object.values(walletKit.getActiveSessions()).map(session =>
    buildWalletConnectSessionViewModel(session),
  );
  setWalletConnectDebugState(prev => ({
    ...prev,
    sessions,
  }));
  return sessions;
}

export function getWalletConnectSession(walletKit: IWalletKit, topic: string) {
  const activeSessions = walletKit.getActiveSessions();
  return activeSessions[topic] || null;
}

export async function resolveWalletConnectAccount(
  session: SessionTypes.Struct,
) {
  const approvedAddress = getWalletConnectApprovedAddresses(session)[0];
  const approvedAccount = getWalletConnectAccountForTopic(session.topic);
  if (!approvedAddress && !approvedAccount) {
    return null;
  }

  try {
    const accounts = await getAllAccountsToDisplay();
    if (approvedAccount) {
      return (
        accounts.find(account =>
          isSameWalletConnectAccount(account, approvedAccount),
        ) || null
      );
    }

    return approvedAddress
      ? accounts.find(account =>
          isSameAddress(account.address, approvedAddress),
        ) || null
      : null;
  } catch (error) {
    addWalletConnectLog(
      'sessions',
      'failed to resolve approved Rabby account',
      error,
      'warn',
    );
    return null;
  }
}

export function getFirstApprovedChain(session: SessionTypes.Struct) {
  return (
    getWalletConnectApprovedChains(session)
      .map(chainId => findChain({ id: Number(chainId.split(':')[1]) }))
      .find(Boolean) || null
  );
}
