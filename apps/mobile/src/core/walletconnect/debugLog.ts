import { appendWalletConnectLog } from './state';
import type { WalletConnectLogLevel } from './types';

let nextLogId = 1;

function serializeData(data: unknown) {
  if (typeof data === 'undefined') {
    return undefined;
  }
  if (typeof data === 'string') {
    return data.slice(0, 2000);
  }
  try {
    return JSON.stringify(data, null, 2).slice(0, 2000);
  } catch (e) {
    return String(data).slice(0, 2000);
  }
}

export function addWalletConnectLog(
  scope: string,
  message: string,
  data?: unknown,
  level: WalletConnectLogLevel = 'info',
) {
  appendWalletConnectLog({
    id: nextLogId++,
    ts: Date.now(),
    scope,
    message,
    level,
    data: serializeData(data),
  });
}
