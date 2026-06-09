import { getAllAccountsToDisplay } from '@/core/apis/account';
import type { IWalletKit } from '@reown/walletkit';
import type { SessionTypes } from '@walletconnect/types';
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

function namespaceApprovesChain(input: {
  namespaceKey: string;
  namespace?: SessionTypes.Namespace;
  chainId: string;
}) {
  if (input.namespaceKey === input.chainId) {
    return true;
  }

  if (input.namespace?.chains?.includes(input.chainId)) {
    return true;
  }

  return !!input.namespace?.accounts?.some(account =>
    account.startsWith(`${input.chainId}:`),
  );
}

export function isWalletConnectMethodApproved(
  session: SessionTypes.Struct,
  chainId: string,
  method: string,
) {
  return Object.entries(session.namespaces || {}).some(
    ([namespaceKey, namespace]) =>
      !!namespace?.methods?.includes(method) &&
      namespaceApprovesChain({
        namespaceKey,
        namespace,
        chainId,
      }),
  );
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
