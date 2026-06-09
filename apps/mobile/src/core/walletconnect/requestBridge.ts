import { sendRequest } from '@/core/apis/sendRequest';
import i18n from '@/utils/i18n';
import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';
import type { SessionTypes } from '@walletconnect/types';
import { ethErrors } from 'eth-rpc-errors';
import { AppState, type AppStateStatus } from 'react-native';
import {
  chainToCaip2,
  getWalletConnectChainByCaip2,
  isSupportedWalletConnectMethod,
} from './chainAccount';
import { recordWalletConnectSessionActivity } from './autoDisconnect';
import { addWalletConnectLog } from './debugLog';
import { maybeRedirectToDapp } from './redirectPolicy';
import {
  getFirstApprovedChain,
  getWalletConnectApprovedChains,
  getWalletConnectSession,
  getWalletConnectSessionOrigin,
  resolveWalletConnectAccount,
  syncWalletConnectSessionsFromClient,
} from './sessions';

type WalletConnectJsonRpcResponse =
  | {
      id: number;
      jsonrpc: '2.0';
      result: unknown;
    }
  | {
      id: number;
      jsonrpc: '2.0';
      error: {
        code: number;
        message: string;
      };
    };

const WALLETCONNECT_DIRECT_RESPONSE_METHODS = new Set([
  'eth_accounts',
  'eth_requestAccounts',
  'eth_chainId',
  'net_version',
]);
const WALLET_SWITCH_ETHEREUM_CHAIN_METHOD = 'wallet_switchEthereumChain';
const WALLETCONNECT_TRANSACTION_METHODS = new Set(['eth_sendTransaction']);
const WALLETCONNECT_TRANSACTION_RETURN_TOASTS = {
  sent: {
    variant: 'success',
    messageKey: 'page.walletConnect.transactionSentReturnToBrowser',
  },
  canceled: {
    variant: 'error',
    messageKey: 'page.walletConnect.transactionCanceledReturnToBrowser',
  },
} as const;

function requiresWalletConnectApproval(method: string) {
  return !WALLETCONNECT_DIRECT_RESPONSE_METHODS.has(method);
}

function isWalletConnectTransactionMethod(method?: string) {
  return !!method && WALLETCONNECT_TRANSACTION_METHODS.has(method);
}

function getWalletConnectTransactionReturnToast(input: {
  method?: string;
  response: WalletConnectJsonRpcResponse;
}) {
  if (!isWalletConnectTransactionMethod(input.method)) {
    return undefined;
  }

  const status = 'result' in input.response ? 'sent' : 'canceled';
  const toast = WALLETCONNECT_TRANSACTION_RETURN_TOASTS[status];
  return {
    variant: toast.variant,
    message: i18n.t(toast.messageKey),
  };
}

function isAppStateActive(state: AppStateStatus) {
  return state === 'active';
}

function isAppActive() {
  return !AppState.isAvailable || isAppStateActive(AppState.currentState);
}

function getCurrentAppStateForLog() {
  return AppState.isAvailable ? AppState.currentState : 'unavailable';
}

async function waitForAppActiveBeforeApproval(method: string) {
  if (isAppActive()) {
    return;
  }

  addWalletConnectLog(
    'request',
    'waiting for app foreground before approval',
    {
      method,
      appState: AppState.currentState,
    },
    'warn',
  );

  await new Promise<void>(resolve => {
    const subscription = AppState.addEventListener('change', state => {
      if (!isAppStateActive(state)) {
        return;
      }

      subscription.remove();
      resolve();
    });
  });

  addWalletConnectLog('request', 'app foregrounded before approval', {
    method,
  });
}

function normalizeRequestParams(params: unknown) {
  if (Array.isArray(params)) {
    return params;
  }
  if (typeof params === 'undefined' || params === null) {
    return [];
  }
  return [params];
}

function normalizeSwitchEthereumChainId(params: unknown) {
  const [chainParams] = normalizeRequestParams(params);
  if (!chainParams || typeof chainParams !== 'object') {
    throw ethErrors.rpc.invalidParams('params is required but got []');
  }

  const rawChainId = (chainParams as { chainId?: unknown }).chainId;
  if (typeof rawChainId === 'undefined' || rawChainId === null) {
    throw ethErrors.rpc.invalidParams('chainId is required');
  }

  let chainId = NaN;
  if (typeof rawChainId === 'number') {
    chainId = rawChainId;
  } else if (typeof rawChainId === 'string') {
    const normalizedChainId = rawChainId.trim().toLowerCase();
    chainId = normalizedChainId.startsWith('0x')
      ? Number.parseInt(normalizedChainId, 16)
      : Number(normalizedChainId);
  }

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw ethErrors.rpc.invalidParams('chainId is invalid');
  }

  return chainId;
}

function getRpcError(error: unknown) {
  const record =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : null;
  const data =
    record?.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : null;

  return {
    code:
      typeof record?.code === 'number'
        ? record.code
        : typeof data?.code === 'number'
        ? data.code
        : 5000,
    message:
      (typeof record?.message === 'string' ? record.message : '') ||
      (typeof data?.message === 'string' ? data.message : '') ||
      (typeof error === 'string' ? error : 'WalletConnect request failed.'),
  };
}

function getRequestChain(
  event: WalletKitTypes.EventArguments['session_request'],
  session: SessionTypes.Struct,
) {
  return (
    getWalletConnectChainByCaip2(event.params.chainId) ||
    getFirstApprovedChain(session)
  );
}

async function switchWalletConnectEthereumChain(input: {
  walletKit: IWalletKit;
  topic: string;
  session: SessionTypes.Struct;
  params: unknown;
}) {
  const targetChainId = normalizeSwitchEthereumChainId(input.params);
  const targetChain = getWalletConnectChainByCaip2(`eip155:${targetChainId}`);

  if (!targetChain) {
    throw ethErrors.provider.custom({
      code: 4902,
      message: `WalletConnect chain is not supported: eip155:${targetChainId}`,
    });
  }

  const targetCaip2 = chainToCaip2(targetChain);
  if (!getWalletConnectApprovedChains(input.session).includes(targetCaip2)) {
    throw ethErrors.provider.custom({
      code: 4902,
      message: `WalletConnect chain is not approved for this session: ${targetCaip2}`,
    });
  }

  await input.walletKit.emitSessionEvent({
    topic: input.topic,
    chainId: targetCaip2,
    event: {
      name: 'chainChanged',
      data: targetCaip2,
    },
  });
  addWalletConnectLog('request', 'wallet_switchEthereumChain emitted', {
    topic: input.topic,
    chainId: targetCaip2,
  });

  return null;
}

async function executeSessionRequest(input: {
  walletKit: IWalletKit;
  event: WalletKitTypes.EventArguments['session_request'];
  session: SessionTypes.Struct;
}) {
  const { event, session, walletKit } = input;
  const { method, params } = event.params.request;

  if (!method || !isSupportedWalletConnectMethod(method)) {
    throw ethErrors.rpc.methodNotFound({
      message: `WalletConnect method is not supported: ${method || 'unknown'}`,
    });
  }

  const chain = getRequestChain(event, session);
  if (!chain) {
    throw ethErrors.provider.custom({
      code: 4902,
      message: `WalletConnect chain is not supported: ${
        event.params.chainId || 'unknown'
      }`,
    });
  }

  const account = await resolveWalletConnectAccount(session);
  if (!account) {
    throw ethErrors.provider.unauthorized({
      message: 'No Rabby account is available for this WalletConnect session.',
    });
  }

  if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
    return [account.address.toLowerCase()];
  }
  if (method === 'eth_chainId') {
    return chain.hex;
  }
  if (method === 'net_version') {
    return chain.network;
  }
  if (method === WALLET_SWITCH_ETHEREUM_CHAIN_METHOD) {
    return switchWalletConnectEthereumChain({
      walletKit,
      topic: event.topic,
      session,
      params,
    });
  }

  await waitForAppActiveBeforeApproval(method);

  const origin = getWalletConnectSessionOrigin(session);
  return sendRequest({
    data: {
      method,
      params: normalizeRequestParams(params),
      $ctx: {},
    },
    session: {
      origin,
      name: session.peer?.metadata?.name || 'WalletConnect dapp',
      icon: session.peer?.metadata?.icons?.[0] || '',
      $mobileCtx: {
        isFromWalletConnect: true,
      },
    },
    account,
    requestContext: {
      origin,
      source: 'walletconnect',
      chainId: chain.id,
      accountAddress: account.address,
    },
  });
}

export async function handleWalletConnectSessionRequest(input: {
  walletKit: IWalletKit;
  event: WalletKitTypes.EventArguments['session_request'];
}) {
  const { walletKit, event } = input;
  const session = getWalletConnectSession(walletKit, event.topic);
  const method = event.params.request.method;
  const shouldRedirectAfterResponse =
    !!session &&
    !!method &&
    isSupportedWalletConnectMethod(method) &&
    requiresWalletConnectApproval(method);
  let response: WalletConnectJsonRpcResponse;

  addWalletConnectLog('request', 'session_request received', {
    topic: event.topic,
    id: event.id,
    method,
    chainId: event.params.chainId,
    appState: getCurrentAppStateForLog(),
  });
  if (session) {
    recordWalletConnectSessionActivity(walletKit, event.topic);
  }

  try {
    if (!session) {
      throw ethErrors.provider.disconnected('WalletConnect session not found.');
    }
    response = {
      id: event.id,
      jsonrpc: '2.0',
      result: await executeSessionRequest({ walletKit, event, session }),
    };
  } catch (error) {
    response = {
      id: event.id,
      jsonrpc: '2.0',
      error: getRpcError(error),
    };
  }

  try {
    await walletKit.respondSessionRequest({
      topic: event.topic,
      response,
    });
    addWalletConnectLog('request', 'session_request responded', {
      topic: event.topic,
      id: event.id,
      ok: 'result' in response,
      method,
    });
    if (shouldRedirectAfterResponse) {
      const iosNoRedirectToast = getWalletConnectTransactionReturnToast({
        method,
        response,
      });
      await maybeRedirectToDapp({
        nativeRedirect: session.peer?.metadata?.redirect?.native,
        ...(iosNoRedirectToast ? { iosNoRedirectToast } : {}),
      });
    }
  } catch (error) {
    addWalletConnectLog(
      'request',
      'respondSessionRequest failed',
      error,
      'error',
    );
  } finally {
    syncWalletConnectSessionsFromClient(walletKit);
  }
}
