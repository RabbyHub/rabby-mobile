import { urlUtils } from '@rabby-wallet/base-utils';
import { RefLikeObject } from './RPCMethodMiddleware';

/**
 * List of rpc errors caused by the user rejecting a certain action.
 * Errors that include these phrases should not be logged to Sentry.
 * Examples of these errors include:
 * - User rejected the transaction
 * - User cancelled the transaction
 * - User rejected the request.
 * - MetaMask Message Signature: User denied message signature.
 * - MetaMask Personal Message Signature: User denied message signature.
 */
const USER_REJECTED_ERRORS = ['user rejected', 'user denied', 'user cancelled'];

const USER_REJECTED_ERROR_CODE = 4001;

// module augumention
declare module 'json-rpc-engine' {
  export interface JsonRpcRequest<T> {
    // add origin to request
    origin: string;
  }
}

/**
 * Returns a middleware that appends the DApp origin to request
 */
export function createOriginMiddleware(opts: {
  urlRef: RefLikeObject<string>;
}) {
  return function originMiddleware(req: any, _: any, next: Function) {
    req.origin =
      opts.urlRef.current === 'about:rabby'
        ? 'about:rabby'
        : urlUtils.safeGetOrigin(opts.urlRef.current);

    // web3-provider-engine compatibility
    // TODO:provider delete this after web3-provider-engine deprecation
    if (!req.params) {
      req.params = [];
    }

    next();
  };
}

/**
 * Checks if the error code or message contains a user rejected error
 */
function containsUserRejectedError(
  errorMessage: string,
  errorCode: number | string,
) {
  try {
    if (!errorMessage || !(typeof errorMessage === 'string')) return false;

    const userRejectedErrorMessage = USER_REJECTED_ERRORS.some(
      userRejectedError =>
        errorMessage.toLowerCase().includes(userRejectedError.toLowerCase()),
    );

    if (userRejectedErrorMessage) return true;

    if (errorCode === USER_REJECTED_ERROR_CODE) return true;

    return false;
  } catch (e) {
    return false;
  }
}
