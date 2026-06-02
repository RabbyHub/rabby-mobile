import { CHAINS_ENUM } from '@/constant/chains';
import { APP_MMKV_KEYS } from '@/core/storage/mmkvConstants';
import { appMMKV } from '@/core/storage/mmkvInstances';
import { createDappBySession } from '@/core/apis/dapp';
import { getAllAccountsToDisplay } from '@/core/apis/account';
import { dappService } from '@/core/services/shared';
import type { Account } from '@/types/account';
import { findChain } from '@/utils/chain';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import {
  getAddressFromCaip10,
  getChainsFromNamespaces,
  getMethodsFromNamespaces,
  getWalletConnectChainByCaip2,
} from './chainAccount';
import { addWalletConnectLog } from './debugLog';
import { setWalletConnectDebugState } from './state';
import type {
  WalletConnectPairingSource,
  WalletConnectSessionViewModel,
  WalletConnectStoredSessionAccount,
} from './types';

type StoredWalletConnectSessionMetadata = {
  selectedAccountByTopic?: Record<string, WalletConnectStoredSessionAccount>;
  sourceByTopic?: Record<string, WalletConnectPairingSource>;
};

const SESSION_METADATA_KEY = APP_MMKV_KEYS.WALLETCONNECT_SESSION_METADATA;

function loadStoredSessionMetadata(): Required<StoredWalletConnectSessionMetadata> {
  const empty = {
    selectedAccountByTopic: {},
    sourceByTopic: {},
  };
  const raw = appMMKV.getString(SESSION_METADATA_KEY);
  if (!raw) {
    return empty;
  }

  try {
    const parsed = JSON.parse(raw) as StoredWalletConnectSessionMetadata;
    return {
      selectedAccountByTopic:
        parsed?.selectedAccountByTopic &&
        typeof parsed.selectedAccountByTopic === 'object'
          ? parsed.selectedAccountByTopic
          : {},
      sourceByTopic:
        parsed?.sourceByTopic && typeof parsed.sourceByTopic === 'object'
          ? parsed.sourceByTopic
          : {},
    };
  } catch (error) {
    addWalletConnectLog(
      'sessions',
      'failed to load stored session metadata',
      error,
      'warn',
    );
    return empty;
  }
}

const storedSessionMetadata = loadStoredSessionMetadata();

const selectedAccountByTopic = new Map<
  string,
  WalletConnectStoredSessionAccount
>(Object.entries(storedSessionMetadata.selectedAccountByTopic));
const sourceByTopic = new Map<string, WalletConnectPairingSource>(
  Object.entries(storedSessionMetadata.sourceByTopic),
);
const originByTopic = new Map<string, string>();

function persistSessionMetadata() {
  appMMKV.set(
    SESSION_METADATA_KEY,
    JSON.stringify({
      selectedAccountByTopic: Object.fromEntries(selectedAccountByTopic),
      sourceByTopic: Object.fromEntries(sourceByTopic),
    } satisfies Required<StoredWalletConnectSessionMetadata>),
  );
}

function getMetadata(session: any) {
  const metadata = session?.peer?.metadata || {};
  return {
    name: metadata.name || 'Unknown dapp',
    description: metadata.description || '',
    url: metadata.url || '',
    icons: Array.isArray(metadata.icons) ? metadata.icons : [],
    redirectNative: metadata.redirect?.native || '',
  };
}

export function getWalletConnectSessionOrigin(session: any) {
  const metadata = getMetadata(session);
  return safeGetOrigin(metadata.url || '') || 'https://walletconnect.localhost';
}

function getApprovedAccounts(session: any) {
  const accounts = new Set<string>();
  Object.values(session?.namespaces || {}).forEach((namespace: any) => {
    if (Array.isArray(namespace?.accounts)) {
      namespace.accounts.forEach((account: string) => {
        if (account) {
          accounts.add(account);
        }
      });
    }
  });
  return Array.from(accounts);
}

function getApprovedChains(session: any) {
  const chainsFromNamespaces = getChainsFromNamespaces(session?.namespaces);
  if (chainsFromNamespaces.length) {
    return chainsFromNamespaces;
  }

  return getApprovedAccounts(session)
    .map(account => account.split(':').slice(0, 2).join(':'))
    .filter(Boolean);
}

function getDefaultChainEnum(session: any) {
  const firstChain = getApprovedChains(session)[0];
  return getWalletConnectChainByCaip2(firstChain)?.enum || CHAINS_ENUM.ETH;
}

function getSelectedAccount(topic: string, session: any) {
  const selected = selectedAccountByTopic.get(topic);
  if (selected) {
    return selected;
  }

  const origin = getWalletConnectSessionOrigin(session);
  const dappAccount = dappService.getDapp(origin)?.currentAccount;
  if (dappAccount) {
    return dappAccount;
  }

  const firstAccount = getApprovedAccounts(session)[0];
  const address = firstAccount ? getAddressFromCaip10(firstAccount) : '';
  return address
    ? {
        address,
      }
    : undefined;
}

export function rememberWalletConnectSession(input: {
  topic: string;
  account: Account;
  source: WalletConnectPairingSource;
}) {
  selectedAccountByTopic.set(input.topic, {
    address: input.account.address,
    type: input.account.type,
    brandName: input.account.brandName,
  });
  sourceByTopic.set(input.topic, input.source);
  persistSessionMetadata();
}

export function forgetWalletConnectSession(topic: string) {
  selectedAccountByTopic.delete(topic);
  sourceByTopic.delete(topic);
  originByTopic.delete(topic);
  persistSessionMetadata();
}

export function getWalletConnectSessionSource(topic: string) {
  return sourceByTopic.get(topic) || 'manual';
}

export function buildWalletConnectSessionViewModel(
  session: any,
): WalletConnectSessionViewModel {
  const topic = session.topic;
  originByTopic.set(topic, getWalletConnectSessionOrigin(session));
  return {
    topic,
    peer: getMetadata(session),
    source: getWalletConnectSessionSource(topic),
    chains: getApprovedChains(session),
    methods: getMethodsFromNamespaces(session.namespaces),
    accounts: getApprovedAccounts(session),
    selectedAccount: getSelectedAccount(topic, session),
  };
}

export function syncWalletConnectSessionsFromClient(walletKit: any) {
  const activeSessions = walletKit?.getActiveSessions?.() || {};
  const activeTopics = new Set(
    Object.values(activeSessions)
      .map((session: any) => session?.topic)
      .filter(Boolean),
  );
  let metadataChanged = false;
  selectedAccountByTopic.forEach((_value, topic) => {
    if (!activeTopics.has(topic)) {
      selectedAccountByTopic.delete(topic);
      metadataChanged = true;
    }
  });
  sourceByTopic.forEach((_value, topic) => {
    if (!activeTopics.has(topic)) {
      sourceByTopic.delete(topic);
      metadataChanged = true;
    }
  });
  if (metadataChanged) {
    persistSessionMetadata();
  }

  const sessions = Object.values(activeSessions).map(session =>
    buildWalletConnectSessionViewModel(session),
  );
  setWalletConnectDebugState(prev => ({
    ...prev,
    sessions,
  }));
  return sessions;
}

export function getWalletConnectSession(walletKit: any, topic: string) {
  const activeSessions = walletKit?.getActiveSessions?.() || {};
  return activeSessions[topic] || null;
}

export function ensureWalletConnectDappMirror(input: {
  session: any;
  account: Account;
}) {
  const metadata = getMetadata(input.session);
  const origin = getWalletConnectSessionOrigin(input.session);
  const icon = metadata.icons?.[0] || '';
  const dapp = createDappBySession({
    origin,
    name: metadata.name,
    icon,
  });
  const chainId = getDefaultChainEnum(input.session);

  dappService.patchDapps({
    [origin]: {
      ...dapp,
      name: metadata.name,
      icon,
      url: metadata.url,
      chainId,
      isConnected: true,
      isDapp: true,
      currentAccount: input.account,
    },
  });
}

export function disconnectWalletConnectDappMirror(session: any) {
  const origin = getWalletConnectSessionOrigin(session);
  if (dappService.getConnectedDapp(origin)) {
    dappService.disconnect(origin);
  }
}

export function disconnectWalletConnectDappMirrorByTopic(topic: string) {
  const origin = originByTopic.get(topic);
  if (origin && dappService.getConnectedDapp(origin)) {
    dappService.disconnect(origin);
  }
}

export async function resolveWalletConnectAccount(input: {
  topic: string;
  session: any;
}) {
  const selected = selectedAccountByTopic.get(input.topic);
  const origin = getWalletConnectSessionOrigin(input.session);
  const dappAccount = dappService.getDapp(origin)?.currentAccount || null;

  if (selected && dappAccount?.address?.toLowerCase() === selected.address) {
    return dappAccount as Account;
  }

  if (dappAccount) {
    return dappAccount as Account;
  }

  const approvedAddress = getApprovedAccounts(input.session)
    .map(getAddressFromCaip10)
    .find(Boolean);

  if (!approvedAddress) {
    return null;
  }

  try {
    const accounts = await getAllAccountsToDisplay();
    return (
      accounts.find(
        account =>
          account.address.toLowerCase() === approvedAddress.toLowerCase(),
      ) || null
    );
  } catch (e) {
    addWalletConnectLog(
      'sessions',
      'failed to resolve approved Rabby account',
      e,
      'warn',
    );
    return null;
  }
}

export function getFirstApprovedChain(session: any) {
  return (
    getApprovedChains(session)
      .map(chainId => findChain({ id: Number(chainId.split(':')[1]) }))
      .find(Boolean) || null
  );
}
