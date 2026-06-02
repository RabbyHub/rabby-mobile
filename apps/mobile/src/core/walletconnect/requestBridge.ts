import { sendRequest } from '@/core/apis/sendRequest';
import { ethErrors } from 'eth-rpc-errors';
import {
  getWalletConnectChainByCaip2,
  isSupportedWalletConnectMethod,
} from './chainAccount';
import { addWalletConnectLog } from './debugLog';
import { maybeRedirectToDapp } from './redirectPolicy';
import {
  ensureWalletConnectDappMirror,
  getFirstApprovedChain,
  getWalletConnectSession,
  getWalletConnectSessionOrigin,
  getWalletConnectSessionSource,
  resolveWalletConnectAccount,
  syncWalletConnectSessionsFromClient,
} from './sessions';
import { setWalletConnectDebugState } from './state';
import {
  respondSessionRequestOnce,
  type WalletConnectJsonRpcResponse,
} from './requestResponse';

function toPendingRequest(event: any, session: any) {
  return {
    id: event.id,
    topic: event.topic,
    chainId: event.params?.chainId || '',
    method: event.params?.request?.method || '',
    receivedAt: Date.now(),
    peer: session
      ? {
          name: session.peer?.metadata?.name || 'Unknown dapp',
          description: session.peer?.metadata?.description || '',
          url: session.peer?.metadata?.url || '',
          icons: session.peer?.metadata?.icons || [],
          redirectNative: session.peer?.metadata?.redirect?.native || '',
        }
      : undefined,
  };
}

function addPendingRequest(event: any, session: any) {
  const pending = toPendingRequest(event, session);
  setWalletConnectDebugState(prev => ({
    ...prev,
    pendingRequests: [
      pending,
      ...prev.pendingRequests.filter(
        item => item.id !== pending.id || item.topic !== pending.topic,
      ),
    ],
  }));
}

function removePendingRequest(event: any) {
  setWalletConnectDebugState(prev => ({
    ...prev,
    pendingRequests: prev.pendingRequests.filter(
      item => item.id !== event.id || item.topic !== event.topic,
    ),
  }));
}

function normalizeRpcError(error: any) {
  const code =
    typeof error?.code === 'number'
      ? error.code
      : typeof error?.data?.code === 'number'
      ? error.data.code
      : 5000;
  const message =
    error?.message ||
    error?.data?.message ||
    (typeof error === 'string' ? error : 'WalletConnect request failed.');

  return {
    code,
    message,
    data: error?.data,
  };
}

function getRequestChain(event: any, session: any) {
  const chainFromEvent = getWalletConnectChainByCaip2(event.params?.chainId);
  if (chainFromEvent) {
    return chainFromEvent;
  }

  return getFirstApprovedChain(session);
}

async function executeSessionRequest(input: { event: any; session: any }) {
  const { event, session } = input;
  const request = event.params?.request || {};
  const method = request.method;
  const params = request.params || [];

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
        event.params?.chainId || 'unknown'
      }`,
    });
  }

  const account = await resolveWalletConnectAccount({
    topic: event.topic,
    session,
  });
  if (!account) {
    throw ethErrors.provider.unauthorized({
      message: 'No Rabby account is available for this WalletConnect session.',
    });
  }

  ensureWalletConnectDappMirror({
    session,
    account,
  });

  if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
    return [account.address.toLowerCase()];
  }

  if (method === 'eth_chainId') {
    return chain.hex;
  }

  if (method === 'net_version') {
    return chain.network;
  }

  return sendRequest({
    data: {
      method,
      params,
      $ctx: {},
    },
    session: {
      origin: getWalletConnectSessionOrigin(session),
      name: session.peer?.metadata?.name || 'WalletConnect dapp',
      icon: session.peer?.metadata?.icons?.[0] || '',
      $mobileCtx: {
        isFromWalletConnect: true,
      },
    },
    account,
    requestContext: {
      origin: getWalletConnectSessionOrigin(session),
      source: 'walletconnect',
      chainId: chain.id,
      accountAddress: account.address,
    },
  });
}

export async function handleWalletConnectSessionRequest(input: {
  walletKit: any;
  event: any;
}) {
  const { walletKit, event } = input;
  const session = getWalletConnectSession(walletKit, event.topic);
  if (!session) {
    addWalletConnectLog(
      'request',
      'session_request received for unknown session',
      event,
      'warn',
    );
  } else {
    addPendingRequest(event, session);
    addWalletConnectLog('request', 'session_request received', {
      topic: event.topic,
      id: event.id,
      method: event.params?.request?.method,
      chainId: event.params?.chainId,
    });
  }

  let response: WalletConnectJsonRpcResponse;
  try {
    if (!session) {
      throw ethErrors.provider.disconnected('WalletConnect session not found.');
    }
    const result = await executeSessionRequest({ event, session });
    response = {
      id: event.id,
      jsonrpc: '2.0',
      result,
    };
  } catch (error) {
    response = {
      id: event.id,
      jsonrpc: '2.0',
      error: normalizeRpcError(error),
    };
  }

  try {
    await respondSessionRequestOnce({
      walletKit,
      topic: event.topic,
      id: event.id,
      response,
    });
    addWalletConnectLog('request', 'session_request responded', {
      topic: event.topic,
      id: event.id,
      ok: 'result' in response,
      method: event.params?.request?.method,
    });
  } catch (e) {
    addWalletConnectLog('request', 'respondSessionRequest failed', e, 'error');
  } finally {
    removePendingRequest(event);
    syncWalletConnectSessionsFromClient(walletKit);
  }

  if (session) {
    await maybeRedirectToDapp({
      source: getWalletConnectSessionSource(event.topic),
      nativeRedirect: session.peer?.metadata?.redirect?.native,
    });
  }
}
