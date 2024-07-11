import { createAsyncMiddleware } from 'json-rpc-engine';

import { isWhitelistedRPC, RPCStageTypes } from '../rpc/events';
import { keyringService } from '@/core/services';
import { sendRequest } from '@/core/apis/sendRequest';
import { ProviderRequest } from '@/core/controllers/type';
import { shouldAllowApprovePopup } from '../state';
import { ethErrors } from 'eth-rpc-errors';

let appVersion = '';

export enum ApprovalTypes {
  CONNECT_ACCOUNTS = 'CONNECT_ACCOUNTS',
  SIGN_MESSAGE = 'SIGN_MESSAGE',
  ADD_ETHEREUM_CHAIN = 'ADD_ETHEREUM_CHAIN',
  SWITCH_ETHEREUM_CHAIN = 'SWITCH_ETHEREUM_CHAIN',
  REQUEST_PERMISSIONS = 'wallet_requestPermissions',
  WALLET_CONNECT = 'WALLET_CONNECT',
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
    const checkTabActive = () => {};

    const providerSessionBase: ProviderRequest['session'] & object = {
      name: titleRef.current,
      origin: req.origin,
      icon: iconRef.current || '',
    };

    const srcOrigin = req.origin;
    const notAllowedNow = !shouldAllowApprovePopup({ dappOrigin: srcOrigin });

    const rpcMethods = {
      ['@reject']: async () => {
        throw ethErrors.provider.userRejectedRequest({
          message: 'Not Allowed',
        });
      },
      // wallet_getPermissions: async () => new Promise<any>(resolve => {}),
      // wallet_requestPermissions: async () => {
      //   res.result = [
      //     {
      //       parentCapability: 'eth_accounts',
      //     },
      //   ];
      // },
      // eth_getTransactionByHash: async () => {},
      // eth_getTransactionByBlockHashAndIndex: async () => {},
      // eth_getTransactionByBlockNumberAndIndex: async () => {},
      // // eth_hashrate: () => {
      // //   res.result = '0x00';
      // // },
      // eth_mining: () => {
      //   res.result = false;
      // },
      // net_listening: () => {
      //   res.result = true;
      // },
      // // TODO: if useless, delete it
      // parity_defaultAccount: getEthAccounts,
      // eth_sendTransaction: async () => {},
      // eth_signTransaction: async () => {},
      // // eth_sign: async () => {},
      // // personal_sign: async () => {},
      // personal_ecRecover: () => {
      //   const data = req.params?.[0];
      //   const signature = req.params?.[1];
      //   const address = recoverPersonalSignature({ data, signature });
      //   res.result = address;
      // },
      // parity_checkRequest: () => {},
      // eth_signTypedData: async () => {},
      // eth_signTypedData_v3: async () => {},
      // eth_signTypedData_v4: async () => {},
      // web3_clientVersion: async () => {
      //   if (!appVersion) {
      //     appVersion = await getVersion();
      //   }
      //   res.result = `Rabby/${appVersion}/Mobile`;
      // },
      // wallet_scanQRCode: () =>
      //   new Promise<void>((resolve, reject) => {
      //     checkTabActive();
      //   }),
      // wallet_watchAsset: async () => {},
      // wallet_addEthereumChain: () => {
      //   checkTabActive();
      // },
      // wallet_switchEthereumChain: () => {
      //   checkTabActive();
      // },
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
      if (notAllowedNow) {
        if (__DEV__) {
          console.debug(
            `[getRpcMethodMiddleware] req.method: '${req.method}'(req.id: ${req.id}) not allowed now`,
          );
        }
        await rpcMethods['@reject']();
      } else if (rpcMethods[req.method]) {
        if (__DEV__) {
          console.debug(
            `[getRpcMethodMiddleware] req.method: '${req.method}'(req.id: ${req.id}) use customized route`,
          );
        }
        await rpcMethods[req.method]();
      } else {
        if (__DEV__) {
          console.debug(
            `[getRpcMethodMiddleware] req.method: '${req.method}'(req.id: ${req.id}) use providerController`,
          );
        }
        res.result = await sendRequest(
          {
            method: req.method,
            params: req.params,
            $ctx: {},
          },
          providerSessionBase,
        );
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
    }
  });
export default getRpcMethodMiddleware;
