import { createAsyncMiddleware } from 'json-rpc-engine';

import { isWhitelistedRPC, RPCStageTypes } from '../rpc/events';
import { keyringService } from '@/core/services';
import { dappSendRequest } from '@/core/apis/sendRequest';
import { ProviderRequest } from '@/core/controllers/type';
import { getActiveDappState, isRpcAllowed } from '../state';
import { ethErrors } from 'eth-rpc-errors';
import { SAFE_RPC_METHODS, SELF_CHECK_RPC_METHOD } from '@/constant/rpc';

let appVersion = '';

export enum ApprovalTypes {
  CONNECT_ACCOUNTS = 'CONNECT_ACCOUNTS',
  SIGN_MESSAGE = 'SIGN_MESSAGE',
  ADD_ETHEREUM_CHAIN = 'ADD_ETHEREUM_CHAIN',
  SWITCH_ETHEREUM_CHAIN = 'SWITCH_ETHEREUM_CHAIN',
  REQUEST_PERMISSIONS = 'wallet_requestPermissions',
  ETH_SIGN = 'eth_sign',
  PERSONAL_SIGN = 'personal_sign',
  ETH_SIGN_TYPED_DATA = 'eth_signTypedData',
  WATCH_ASSET = 'wallet_watchAsset',
  TRANSACTION = 'transaction',
  RESULT_ERROR = 'result_error',
  RESULT_SUCCESS = 'result_success',
  ///: BEGIN:ONLY_INCLUDE_IF(snaps)
  INSTALL_SNAP = 'wallet_installSnap',
  UPDATE_SNAP = 'wallet_updateSnap',
  ///: END:ONLY_INCLUDE_IF
}

export type RefLikeObject<T> = { current: T };

export interface RPCMethodsMiddleParameters {
  hostname: string;
  // navigation: any;
  urlRef: RefLikeObject<string>;
  titleRef: RefLikeObject<string>;
  iconRef: RefLikeObject<string | undefined>;
  bridge: import('../BackgroundBridge').BackgroundBridge;
  // // Bookmarks
  // isHomepage: () => boolean;
  // // Show autocomplete
  // fromHomepage: { current: boolean };
  // toggleUrlModal: (shouldClearUrlInput: boolean) => void;
  // // For the browser
  // tabId: number | '' | false;
}

/**
 * Handle RPC methods called by dapps
 */
export const getRpcMethodMiddleware = ({
  hostname,
  urlRef,
  titleRef,
  iconRef,
  bridge,
}: // navigation,
// // Website info
// // Bookmarks
// isHomepage,
// // Show autocomplete
// fromHomepage,
// toggleUrlModal,
// // For the browser
// tabId,
RPCMethodsMiddleParameters) =>
  // all user facing RPC calls not implemented by the provider
  createAsyncMiddleware<{}, any>(async (req, res, next) => {
    // Used by eth_accounts and eth_coinbase RPCs.
    const getEthAccounts = async () => {
      const accounts = await keyringService.getAccounts();

      res.result = accounts;

      return accounts;
    };
    const checkTabActive = () => {
      const activeDappState = getActiveDappState();
      if (!isRpcAllowed(activeDappState)) {
        // // leave here for debug
        console.debug('[checkTabActive] activeDappState', activeDappState);
        return false;
      }

      const webviewId = bridge.webviewId;

      return (
        !activeDappState.isScreenHide && activeDappState.tabId === webviewId
      );
    };

    const providerSessionBase: ProviderRequest['session'] & object = {
      name: titleRef.current,
      origin: req.origin,
      icon: iconRef.current || '',
      $mobileCtx: {
        fromTabId: bridge.webviewId,
      },
    };

    // todo check this
    const methodAllowed =
      req.method === SELF_CHECK_RPC_METHOD ||
      SAFE_RPC_METHODS.includes(req.method) ||
      req.method === 'eth_accounts' ||
      checkTabActive();

    // const methodAllowed =
    //   req.method === SELF_CHECK_RPC_METHOD ||
    //   req.method === 'eth_accounts' ||
    //   checkTabActive();

    const rpcMethods = {
      [SELF_CHECK_RPC_METHOD]: async () => {
        res.result = true;
      },
      ['@reject']: async () => {
        throw ethErrors.provider.userRejectedRequest({
          message: 'Not Allowed',
        });
      },
    };

    if (__DEV__) {
      console.debug(
        `[getRpcMethodMiddleware] req.method: '${req.method}'(req.id: ${req.id})`,
      );
    }
    const isWhiteListedMethod = isWhitelistedRPC(req.method);

    try {
      if (isWhiteListedMethod) {
        // dispatch rpc execution stage change here: RPCStageTypes.REQUEST_SEND
      }
      if (!methodAllowed) {
        if (__DEV__) {
          console.debug(
            `[getRpcMethodMiddleware::not-allowed] req.method: '${req.method}'(req.id: ${req.id}) not allowed now`,
          );
        }
        await rpcMethods['@reject']();
      } else if (rpcMethods[req.method]) {
        if (__DEV__) {
          console.debug(
            `[getRpcMethodMiddleware::pre-hook] req.method: '${req.method}'(req.id: ${req.id}) use customized route`,
          );
        }
        await rpcMethods[req.method]();
      } else {
        if (__DEV__) {
          console.debug(
            `[getRpcMethodMiddleware::rpc-method] req.method: '${req.method}'(req.id: ${req.id}) use providerController`,
          );
        }
        // res.result = await rpcMethods['@reject']();
        res.result = await dappSendRequest({
          data: {
            method: req.method,
            params: req.params,
          },
          session: providerSessionBase,
        });
      }
      if (__DEV__) {
        console.debug(
          `[getRpcMethodMiddleware] res.result for method '${req.method}'(req.id: ${req.id}): `,
          res.result,
        );
      }

      if (isWhiteListedMethod) {
        // dispatch rpc execution stage change here: RPCStageTypes.COMPLETE
      }
    } catch (e) {
      if (isWhiteListedMethod) {
        // dispatch rpc execution stage change here: RPCStageTypes.ERROR
      }
      if (__DEV__) {
        console.debug(
          `[getRpcMethodMiddleware] error for method '${req.method}'(req.id: ${req.id}): `,
          e,
        );
      }
      throw e;
    } finally {
      if (__DEV__) {
        console.debug(
          `[getRpcMethodMiddleware] ================== finally for method '${req.method}'(req.id: ${req.id}) ==================`,
        );
      }
    }
  });
export default getRpcMethodMiddleware;
