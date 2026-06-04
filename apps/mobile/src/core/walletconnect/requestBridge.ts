import { sendRequest } from '@/core/apis/sendRequest';
import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';
import type { SessionTypes } from '@walletconnect/types';
import { ethErrors } from 'eth-rpc-errors';
import {
  getWalletConnectChainByCaip2,
  isSupportedWalletConnectMethod,
} from './chainAccount';
import { recordWalletConnectSessionActivity } from './autoDisconnect';
import { addWalletConnectLog } from './debugLog';
import {
  getFirstApprovedChain,
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

function normalizeRequestParams(params: unknown) {
  if (Array.isArray(params)) {
    return params;
  }
  if (typeof params === 'undefined' || params === null) {
    return [];
  }
  return [params];
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

async function executeSessionRequest(input: {
  event: WalletKitTypes.EventArguments['session_request'];
  session: SessionTypes.Struct;
}) {
  const { event, session } = input;
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
  let response: WalletConnectJsonRpcResponse;

  addWalletConnectLog('request', 'session_request received', {
    topic: event.topic,
    id: event.id,
    method: event.params.request.method,
    chainId: event.params.chainId,
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
      result: await executeSessionRequest({ event, session }),
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
      method: event.params.request.method,
    });
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
