import { addWalletConnectLog } from './debugLog';

export type WalletConnectJsonRpcResponse =
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
        data?: unknown;
      };
    };

const respondedRequestKeys = new Set<string>();

export async function respondSessionRequestOnce(input: {
  walletKit: any;
  topic: string;
  id: number;
  response: WalletConnectJsonRpcResponse;
}) {
  const key = `${input.topic}:${input.id}`;
  if (respondedRequestKeys.has(key)) {
    addWalletConnectLog(
      'request',
      'skipped duplicate session_request response',
      { topic: input.topic, id: input.id },
      'warn',
    );
    return false;
  }

  respondedRequestKeys.add(key);
  await input.walletKit.respondSessionRequest({
    topic: input.topic,
    response: input.response,
  });
  return true;
}
