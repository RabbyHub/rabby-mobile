import { Alert } from 'react-native';
import { getVersion } from 'react-native-device-info';
import {
  createAsyncMiddleware,
  JsonRpcEngineCallbackError,
} from 'json-rpc-engine';
import { ethErrors } from 'eth-rpc-errors';

import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import { isWhitelistedRPC, RPCStageTypes } from '../rpc/events';
import { keyringService } from '@/core/services';

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

export interface RPCMethodsMiddleParameters {
  hostname: string;
  getProviderState: () => any;
  // navigation: any;
  // url: { current: string };
  // title: { current: string };
  // icon: { current: string | undefined };
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
  getProviderState,
}: // navigation,
// // Website info
// url,
// title,
// icon,
// // Bookmarks
// isHomepage,
// // Show autocomplete
// fromHomepage,
// toggleUrlModal,
// // For the browser
// tabId,
RPCMethodsMiddleParameters) =>
  // all user facing RPC calls not implemented by the provider
  createAsyncMiddleware(async (req: any, res: any, next: any) => {
    // Used by eth_accounts and eth_coinbase RPCs.
    const getEthAccounts = async () => {
      const accounts = await keyringService.getAccounts();

      res.result = accounts;

      return accounts;
    };

    const checkTabActive = () => {};

    const rpcMethods: any = {
      /**
       * This method is used by the inpage provider to get its state on
       * initialization.
       */
      rabby_getProviderState: async () => {
        res.result = {
          ...getProviderState(),
          accounts: [],
        };
      },
      wallet_getPermissions: async () => new Promise<any>(resolve => {}),
      wallet_requestPermissions: async () => {
        res.result = [
          {
            parentCapability: 'eth_accounts',
          },
        ];
      },

      eth_getTransactionByHash: async () => {},
      eth_getTransactionByBlockHashAndIndex: async () => {},
      eth_getTransactionByBlockNumberAndIndex: async () => {},
      eth_chainId: async () => {
        res.result = '0x1';
      },
      eth_hashrate: () => {
        res.result = '0x00';
      },
      eth_mining: () => {
        res.result = false;
      },
      net_listening: () => {
        res.result = true;
      },
      net_version: async () => {
        res.result = 1;
      },
      eth_requestAccounts: async () => {
        const { params } = req;

        res.result = await getEthAccounts();
      },
      eth_accounts: getEthAccounts,
      eth_coinbase: getEthAccounts,
      parity_defaultAccount: getEthAccounts,
      eth_sendTransaction: async () => {},
      eth_signTransaction: async () => {},
      eth_sign: async () => {},

      personal_sign: async () => {},

      personal_ecRecover: () => {
        const data = req.params[0];
        const signature = req.params[1];
        const address = recoverPersonalSignature({ data, signature });

        res.result = address;
      },

      parity_checkRequest: () => {},

      eth_signTypedData: async () => {},

      eth_signTypedData_v3: async () => {},

      eth_signTypedData_v4: async () => {},

      web3_clientVersion: async () => {
        if (!appVersion) {
          appVersion = await getVersion();
        }
        res.result = `Rabby/${appVersion}/Mobile`;
      },

      wallet_scanQRCode: () =>
        new Promise<void>((resolve, reject) => {
          checkTabActive();
        }),

      wallet_watchAsset: async () => {},
      wallet_addEthereumChain: () => {
        checkTabActive();
      },

      wallet_switchEthereumChain: () => {
        checkTabActive();
      },
    };

    if (__DEV__) {
      console.debug('[getRpcMethodMiddleware] req.method: ', req.method);
    }
    if (!rpcMethods[req.method]) {
      return next();
    }
    const isWhiteListedMethod = isWhitelistedRPC(req.method);

    try {
      if (isWhiteListedMethod) {
        // dispatch rpc execution stage change here: RPCStageTypes.REQUEST_SEND
      }
      await rpcMethods[req.method]();
      if (__DEV__) {
        console.log('[getRpcMethodMiddleware] res.result: ', res.result);
      }

      if (isWhiteListedMethod) {
        // dispatch rpc execution stage change here: RPCStageTypes.COMPLETE
      }
    } catch (e) {
      if (isWhiteListedMethod) {
        // dispatch rpc execution stage change here: RPCStageTypes.ERROR
      }
      throw e;
    }
  });
export default getRpcMethodMiddleware;
