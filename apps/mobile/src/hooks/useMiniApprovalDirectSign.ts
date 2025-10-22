import { useCallback } from 'react';

export const useResetMiniApprovalDirectSignState = () => {
  const resetState = useCallback(() => {}, []);

  return resetState;
};

export const AbortedDirectSubmitErrorCode = 'AbortedDirectSubmitError';
export class AbortedDirectSubmitError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: string = AbortedDirectSubmitErrorCode,
    statusCode?: number,
  ) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const isAbortedDirectSubmitError = (e: any) => {
  if (
    e instanceof AbortedDirectSubmitError &&
    e.code === AbortedDirectSubmitErrorCode
  ) {
    return true;
  }
  return false;
};
