import type { FailReason } from './types';

export type MiniSignErrorCodes = {
  GAS_NOT_ENOUGH: string;
  CANT_PROCESS: string;
  PREFETCH_FAILURE: string;
};

/** MiniSign rejects with string codes, but prefetch may throw an Error with the same message. */
export const classifySignError = (
  error: unknown,
  codes: MiniSignErrorCodes,
): FailReason => {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : undefined;
  if (message === codes.GAS_NOT_ENOUGH || message === codes.CANT_PROCESS) {
    return 'gasNotEnough';
  }
  if (message === codes.PREFETCH_FAILURE) {
    return 'simulationFailed';
  }
  return 'failed';
};
