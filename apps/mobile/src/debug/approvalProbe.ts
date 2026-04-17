import { APP_RUNTIME_ENV } from '@/constant/env';
import { logger } from '@/utils/logger';

type ApprovalProbeLevel = 'debug' | 'info' | 'warn' | 'error';

const APPROVAL_PROBE_ENABLED = APP_RUNTIME_ENV !== 'production';

const APPROVAL_PROBE_METHODS = new Set<string>([
  'eth_requestAccounts',
  'wallet_requestPermissions',
  'personal_sign',
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v1',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_sendTransaction',
  'wallet_addEthereumChain',
  'wallet_switchEthereumChain',
]);

function getLoggerMethod(level: ApprovalProbeLevel) {
  if (level === 'debug') return logger.debug.bind(logger);
  if (level === 'warn') return logger.warn.bind(logger);
  if (level === 'error') return logger.error.bind(logger);
  return logger.info.bind(logger);
}

export function shouldLogApprovalProbeMethod(
  method: unknown,
): method is string {
  return typeof method === 'string' && APPROVAL_PROBE_METHODS.has(method);
}

export function getApprovalProbeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function recordApprovalProbe(
  stage: string,
  payload?: Record<string, unknown>,
  options?: {
    level?: ApprovalProbeLevel;
  },
) {
  if (!APPROVAL_PROBE_ENABLED) {
    return;
  }

  const level = options?.level || 'info';
  const logPayload = {
    stage,
    ...(payload || {}),
  };

  getLoggerMethod(level)('[approval-probe]', logPayload);
}
