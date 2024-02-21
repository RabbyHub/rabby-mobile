import { Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import {
  bufferToHex,
  isHexString,
  addHexPrefix,
  intToHex,
} from 'ethereumjs-util';
import { stringToHex } from 'web3-utils';
import { ethErrors } from 'eth-rpc-errors';
import {
  normalize as normalizeAddress,
  recoverPersonalSignature,
} from '@metamask/eth-sig-util';
import cloneDeep from 'lodash/cloneDeep';
import { openapi } from '../request';
import {
  preferenceService,
  dappService,
  transactionHistoryService,
  transactionWatcherService,
  transactionBroadcastWatcherService,
} from '@/core/services/shared';
import { keyringService } from '../services';
// import {
//   transactionWatchService,
//   transactionHistoryService,
//   signTextHistoryService,
//   RPCService,
//   swapService,
//   transactionBroadcastWatchService,
//   notificationService,
// } from 'background/service';
// import { Session } from 'background/service/session';
import {
  KEYRING_CATEGORY_MAP,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { Tx, TxPushType } from '@rabby-wallet/rabby-api/dist/types';
import RpcCache from '../services/rpcCache';
// import Wallet from '../wallet';
import { CHAINS_ENUM } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import { SAFE_RPC_METHODS } from '@/constant/rpc';
import BaseController from './base';
import { Account } from '../services/preference';
import BigNumber from 'bignumber.js';
// import { formatTxMetaForRpcResult } from 'background/utils/tx';
import { findChainByEnum } from '@/utils/chain';
import { is1559Tx, validateGasPriceRange } from '@/utils/transaction';
import { eventBus, EVENTS } from '@/utils/events';
import { sessionService } from '../services/shared';
import { BroadcastEvent } from '@/constant/event';
import { createDappBySession } from '../apis/dapp';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { matomoRequestEvent } from '@/utils/analytics';
// import eventBus from '@/eventBus';
// import { StatsData } from '../../service/notification';

const reportSignText = (params: {
  method: string;
  account: Account;
  success: boolean;
}) => {
  const { method, account, success } = params;
  matomoRequestEvent({
    category: 'SignText',
    action: 'completeSignText',
    label: [
      KEYRING_CATEGORY_MAP[account.type],
      account.brandName,
      success,
    ].join('|'),
  });
  // stats.report('completeSignText', {
  //   type: account.brandName,
  //   category: KEYRING_CATEGORY_MAP[account.type],
  //   method,
  //   success,
  // });
};

const covertToHex = (data: Buffer | bigint) => {
  if (typeof data === 'bigint') {
    return `0x${data.toString(16)}`;
  }
  return bufferToHex(data);
};

export interface AddEthereumChainParams {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

interface ApprovalRes extends Tx {
  type?: string;
  address?: string;
  uiRequestComponent?: string;
  isSend?: boolean;
  isSpeedUp?: boolean;
  isCancel?: boolean;
  isSwap?: boolean;
  isGnosis?: boolean;
  account?: Account;
  extra?: Record<string, any>;
  traceId?: string;
  $ctx?: any;
  signingTxId?: string;
  pushType?: TxPushType;
  lowGasDeadline?: number;
  reqId?: string;
}

interface Web3WalletPermission {
  // The name of the method corresponding to the permission
  parentCapability: string;

  // The date the permission was granted, in UNIX epoch time
  date?: number;
}

type SignTypeDataParams = string[];
type Session = {
  icon: string;
  name: string;
  origin: string;
};

const v1SignTypedDataVlidation = ({
  data: {
    params: [_, from],
  },
}: {
  data: {
    params: SignTypeDataParams;
  };
}) => {
  const currentAddress = preferenceService
    .getCurrentAccount()
    ?.address.toLowerCase();
  if (from.toLowerCase() !== currentAddress)
    throw ethErrors.rpc.invalidParams('from should be same as current address');
};

const signTypedDataVlidation = ({
  data: {
    params: [from, data],
  },
  session,
}: {
  data: {
    params: SignTypeDataParams;
  };
  session: Session;
}) => {
  let jsonData;
  try {
    jsonData = JSON.parse(data);
  } catch (e) {
    throw ethErrors.rpc.invalidParams('data is not a validate JSON string');
  }
  const currentChain = dappService.getDapp(session.origin)?.chainId;
  if (jsonData.domain.chainId) {
    const chainItem = findChainByEnum(currentChain);
    if (
      !currentChain ||
      (chainItem && Number(jsonData.domain.chainId) !== chainItem.id)
    ) {
      throw ethErrors.rpc.invalidParams(
        'chainId should be same as current chainId',
      );
    }
  }
  const currentAddress = preferenceService
    .getCurrentAccount()
    ?.address.toLowerCase();
  if (from.toLowerCase() !== currentAddress)
    throw ethErrors.rpc.invalidParams('from should be same as current address');
};

interface RPCRequest {
  method: string;
  params: any[];
}

interface ControllerParams<T> {
  data: {
    params: T;
  };
  session: Session;
  approvalRes: ApprovalRes;
}

class ProviderController extends BaseController {
  @Reflect.metadata('PRIVATE', true)
  ethRpc = (
    req: {
      data: RPCRequest;
      session: Session;
    },
    forceChainServerId?: string,
  ) => {
    const {
      data: { method, params },
      session: { origin },
    } = req;

    if (
      !dappService.getDapp(origin)?.isConnected &&
      !SAFE_RPC_METHODS.includes(method)
    ) {
      throw ethErrors.provider.unauthorized();
    }

    const site = dappService.getDapp(origin);
    let chainServerId = CHAINS[CHAINS_ENUM.ETH].serverId;
    if (site) {
      chainServerId = CHAINS[site.chainId]?.serverId || chainServerId;
    }
    if (forceChainServerId) {
      chainServerId = forceChainServerId;
    }

    const currentAddress =
      preferenceService.getCurrentAccount()?.address.toLowerCase() || '0x';
    const cache = RpcCache.get(currentAddress, {
      method,
      params,
      chainId: chainServerId,
    });
    if (cache) {
      return cache;
    }
    const chain = Object.values(CHAINS).find(
      item => item.serverId === chainServerId,
    )!;
    // if (RPCService.hasCustomRPC(chain.enum)) {
    if (false) {
      // const promise = RPCService.requestCustomRPC(
      //   chain.enum,
      //   method,
      //   params,
      // ).then(result => {
      //   RpcCache.set(currentAddress, {
      //     method,
      //     params,
      //     result,
      //     chainId: chainServerId,
      //   });
      //   return result;
      // });
      // RpcCache.set(currentAddress, {
      //   method,
      //   params,
      //   result: promise,
      //   chainId: chainServerId,
      // });
      // return promise;
    } else {
      const promise = openapi
        .ethRpc(chainServerId, {
          origin: encodeURIComponent(origin),
          method,
          params,
        })
        .then(result => {
          RpcCache.set(currentAddress, {
            method,
            params,
            result,
            chainId: chainServerId,
          });
          return result;
        });
      RpcCache.set(currentAddress, {
        method,
        params,
        result: promise,
        chainId: chainServerId,
      });
      return promise;
    }
  };

  ethRequestAccounts = async ({
    session: { origin },
  }: {
    session: Session;
  }) => {
    if (!dappService.getDapp(origin)?.isConnected) {
      throw ethErrors.provider.unauthorized();
    }

    const _account = await this.getCurrentAccount();
    const account = _account ? [_account.address.toLowerCase()] : [];

    sessionService.broadcastEvent(BroadcastEvent.accountsChanged, account);
    const connectSite = dappService.getConnectedDapp(origin);

    if (connectSite) {
      const chain = CHAINS[connectSite.chainId];
      // // rabby:chainChanged event must be sent before chainChanged event
      // sessionService.broadcastEvent('rabby:chainChanged', chain, origin);
      sessionService.broadcastEvent(
        BroadcastEvent.chainChanged,
        {
          chain: chain.hex,
          networkVersion: chain.network,
        },
        origin,
      );
    }

    return account;
  };

  @Reflect.metadata('SAFE', true)
  ethAccounts = async ({ session: { origin } }: { session: Session }) => {
    if (
      !dappService.getDapp(origin)?.isConnected ||
      !keyringService.isUnlocked()
    ) {
      return [];
    }

    const account = await this.getCurrentAccount();
    return account ? [account.address.toLowerCase()] : [];
  };

  ethCoinbase = async ({ session: { origin } }: { session: Session }) => {
    if (!dappService.getDapp(origin)?.isConnected) {
      return null;
    }

    const account = await this.getCurrentAccount();
    return account ? account.address.toLowerCase() : null;
  };

  @Reflect.metadata('SAFE', true)
  ethChainId = ({ session }: { session: Session }) => {
    const origin = session.origin;
    const site = dappService.getDapp(origin);

    return findChainByEnum(site?.chainId, { fallback: CHAINS_ENUM.ETH })!.hex;
  };

  @Reflect.metadata('APPROVAL', [
    'SignTx',
    ({
      data: {
        params: [tx],
      },
      session,
    }: {
      data: {
        params: any[];
      };
      session: Session;
    }) => {
      const currentAddress = preferenceService
        .getCurrentAccount()
        ?.address.toLowerCase();
      const currentChain = dappService.isInternalDapp(session.origin)
        ? Object.values(CHAINS).find(chain => chain.id === tx.chainId)!.enum
        : dappService.getConnectedDapp(session.origin)?.chainId;
      if (tx.from.toLowerCase() !== currentAddress) {
        throw ethErrors.rpc.invalidParams(
          'from should be same as current address',
        );
      }
      if (
        'chainId' in tx &&
        (!currentChain || Number(tx.chainId) !== CHAINS[currentChain].id)
      ) {
        throw ethErrors.rpc.invalidParams(
          'chainId should be same as current chainId',
        );
      }
    },
  ])
  ethSendTransaction = async (options: {
    data: {
      $ctx?: any;
      params: any;
    };
    session: Session;
    approvalRes: ApprovalRes;
    pushed: boolean;
    result: any;
  }) => {
    if (options.pushed) {
      return options.result;
    }
    const {
      data: {
        params: [txParams],
      },
      session: { origin },
      approvalRes,
    } = cloneDeep(options);
    const keyring = await this._checkAddress(txParams.from);
    const isSend = !!txParams.isSend;
    const isSpeedUp = !!txParams.isSpeedUp;
    const isCancel = !!txParams.isCancel;
    const extra = approvalRes.extra;
    const signingTxId = approvalRes.signingTxId;
    const isCoboSafe = !!txParams.isCoboSafe;
    const pushType = approvalRes.pushType || 'default';
    const lowGasDeadline = approvalRes.lowGasDeadline;
    const preReqId = approvalRes.reqId;

    let signedTransactionSuccess = false;
    delete txParams.isSend;
    delete approvalRes.isSend;
    delete approvalRes.isSwap;
    delete approvalRes.address;
    delete approvalRes.type;
    delete approvalRes.uiRequestComponent;
    delete approvalRes.traceId;
    delete approvalRes.extra;
    delete approvalRes.$ctx;
    delete approvalRes.signingTxId;
    delete approvalRes.pushType;
    delete approvalRes.lowGasDeadline;
    delete approvalRes.reqId;
    delete txParams.isCoboSafe;

    let is1559 = is1559Tx(approvalRes);
    if (
      is1559 &&
      approvalRes.maxFeePerGas === approvalRes.maxPriorityFeePerGas
    ) {
      // fallback to legacy transaction if maxFeePerGas is equal to maxPriorityFeePerGas
      approvalRes.gasPrice = approvalRes.maxFeePerGas;
      delete approvalRes.maxFeePerGas;
      delete approvalRes.maxPriorityFeePerGas;
      is1559 = false;
    }
    const common = Common.custom(
      { chainId: approvalRes.chainId },
      { hardfork: Hardfork.London },
    );
    const txData = { ...approvalRes, gasLimit: approvalRes.gas };
    if (is1559) {
      txData.type = '0x2';
    }
    const tx = TransactionFactory.fromTxData(txData, {
      common,
    });
    const currentAccount = preferenceService.getCurrentAccount()!;
    let opts;
    opts = extra;
    // if (currentAccount.type === KEYRING_TYPE.GnosisKeyring) {
    //   buildinProvider.currentProvider.currentAccount =
    //     approvalRes!.account!.address;
    //   buildinProvider.currentProvider.currentAccountType =
    //     approvalRes!.account!.type;
    //   buildinProvider.currentProvider.currentAccountBrand =
    //     approvalRes!.account!.brandName;
    //   try {
    //     const provider = new ethers.providers.Web3Provider(
    //       buildinProvider.currentProvider,
    //     );
    //     opts = {
    //       provider,
    //     };
    //   } catch (e) {
    //     console.log(e);
    //   }
    // }
    const chain = dappService.isInternalDapp(origin)
      ? Object.values(CHAINS).find(chain => chain.id === approvalRes.chainId)!
          .enum
      : dappService.getConnectedDapp(origin)!.chainId;

    const approvingTx = transactionHistoryService.getSigningTx(signingTxId!);
    if (!approvingTx?.rawTx || !approvingTx?.explain) {
      throw new Error(`approvingTx not found: ${signingTxId}`);
    }
    transactionHistoryService.updateSigningTx(signingTxId!, {
      isSubmitted: true,
    });

    const { explain: cacheExplain, rawTx, action } = approvingTx;

    const chainItem = findChainByEnum(chain);

    // const statsData = {
    //   signed: false,
    //   signedSuccess: false,
    //   submit: false,
    //   submitSuccess: false,
    //   type: currentAccount.brandName,
    //   chainId: chainItem?.serverId || '',
    //   category: KEYRING_CATEGORY_MAP[currentAccount.type],
    //   preExecSuccess: cacheExplain
    //     ? cacheExplain.pre_exec.success && cacheExplain.calcSuccess
    //     : true,
    //   createBy: options?.data?.$ctx?.ga ? 'rabby' : 'dapp',
    //   source: options?.data?.$ctx?.ga?.source || '',
    //   trigger: options?.data?.$ctx?.ga?.trigger || '',
    //   reported: false,
    // };

    try {
      const signedTx = await keyringService.signTransaction(
        keyring,
        tx,
        txParams.from,
        opts,
      );
      // if (
      //   currentAccount.type === KEYRING_TYPE.GnosisKeyring ||
      //   currentAccount.type === KEYRING_TYPE.CoboArgusKeyring
      // ) {
      //   signedTransactionSuccess = true;
      //   statsData.signed = true;
      //   statsData.signedSuccess = true;
      //   return;
      // }

      const onTransactionCreated = (info: {
        hash?: string;
        reqId?: string;
        pushType?: TxPushType;
      }) => {
        const { hash, reqId, pushType = 'default' } = info;
        console.log('onTransactionCreated', {
          hash,
          reqId,
          pushType,
        });
        // if (
        //   options?.data?.$ctx?.stats?.afterSign?.length &&
        //   Array.isArray(options?.data?.$ctx?.stats?.afterSign)
        // ) {
        //   options.data.$ctx.stats.afterSign.forEach(({ name, params }) => {
        //     if (name && params) {
        //       stats.report(name, params);
        //     }
        //   });
        // }

        const { r, s, v, ...other } = approvalRes;
        // TODO: swapService
        // if (hash) {
        //   swapService.postSwap(chain, hash, other);
        // }

        // statsData.submit = true;
        // statsData.submitSuccess = true;
        // if (isSend) {
        //   pageStateCacheService.clear();
        // }
        // TODO: transactionHistory
        transactionHistoryService.addTx({
          address: txParams.from,
          nonce: +approvalRes.nonce,
          chainId: approvalRes.chainId,

          rawTx: {
            ...rawTx,
            ...approvalRes,
            r: covertToHex(signedTx.r),
            s: covertToHex(signedTx.s),
            v: covertToHex(signedTx.v),
          },
          createdAt: Date.now(),
          hash,
          reqId,
          pushType,
          explain: cacheExplain,
          action: action,
          site: dappService.isInternalDapp(origin)
            ? createDappBySession(INTERNAL_REQUEST_SESSION)
            : dappService.getDapp(origin),
          isPending: true,
        });
        transactionHistoryService.removeSigningTx(signingTxId!);
        if (hash) {
          transactionWatcherService.addTx(
            `${txParams.from}_${approvalRes.nonce}_${chain}`,
            {
              nonce: approvalRes.nonce,
              hash,
              chain,
            },
          );
        }
        if (reqId && !hash) {
          transactionBroadcastWatcherService.addTx(reqId, {
            reqId,
            address: txParams.from,
            chainId: CHAINS[chain].id,
            nonce: approvalRes.nonce,
          });
        }

        // if (isCoboSafe) {
        //   preferenceService.resetCurrentCoboSafeAddress();
        // }
      };
      const onTransactionSubmitFailed = (e: any) => {
        if (
          options?.data?.$ctx?.stats?.afterSign?.length &&
          Array.isArray(options?.data?.$ctx?.stats?.afterSign)
        ) {
          // options.data.$ctx.stats.afterSign.forEach(({ name, params }) => {
          //   if (name && params) {
          //     // stats.report(name, params);
          //   }
          // });
        }

        // stats.report('submitTransaction', {
        //   type: currentAccount.brandName,
        //   chainId: chainItem?.serverId || '',
        //   category: KEYRING_CATEGORY_MAP[currentAccount.type],
        //   success: false,
        //   preExecSuccess: cacheExplain
        //     ? cacheExplain.pre_exec.success && cacheExplain.calcSuccess
        //     : true,
        //   createBy: options?.data?.$ctx?.ga ? 'rabby' : 'dapp',
        //   source: options?.data?.$ctx?.ga?.source || '',
        //   trigger: options?.data?.$ctx?.ga?.trigger || '',
        // });
        if (!isSpeedUp && !isCancel) {
          // transactionHistoryService.addSubmitFailedTransaction(
          //   {
          //     rawTx: approvalRes,
          //     createdAt: Date.now(),
          //     isCompleted: true,
          //     hash: '',
          //     failed: false,
          //     isSubmitFailed: true,
          //   },
          //   cacheExplain,
          //   origin,
          // );
        }
        const errMsg = e.message || JSON.stringify(e);
        // if (notificationService.statsData?.signMethod) {
        //   statsData.signMethod = notificationService.statsData?.signMethod;
        // }
        // notificationService.setStatsData(statsData);
        throw new Error(errMsg);
      };

      if (typeof signedTx === 'string') {
        onTransactionCreated({
          hash: signedTx,
          pushType: 'default',
        });
        if (
          currentAccount.type === KEYRING_TYPE.WalletConnectKeyring
          // || currentAccount.type === KEYRING_TYPE.CoinbaseKeyring
        ) {
          // statsData.signed = true;
          // statsData.signedSuccess = true;
        }
        // if (notificationService.statsData?.signMethod) {
        //   statsData.signMethod = notificationService.statsData?.signMethod;
        // }
        // notificationService.setStatsData(statsData);
        return signedTx;
      }

      const buildTx = TransactionFactory.fromTxData({
        ...approvalRes,
        r: addHexPrefix(signedTx.r),
        s: addHexPrefix(signedTx.s),
        v: addHexPrefix(signedTx.v),
        type: is1559 ? '0x2' : '0x0',
      });

      // Report address type(not sensitive information) to sentry when tx signature is invalid
      // TODO: FIXME
      // if (!buildTx.verifySignature()) {
      //   if (!buildTx.v) {
      //     Sentry.captureException(new Error(`v missed, ${keyring.type}`));
      //   } else if (!buildTx.s) {
      //     Sentry.captureException(new Error(`s missed, ${keyring.type}`));
      //   } else if (!buildTx.r) {
      //     Sentry.captureException(new Error(`r missed, ${keyring.type}`));
      //   } else {
      //     Sentry.captureException(
      //       new Error(`invalid signature, ${keyring.type}`),
      //     );
      //   }
      // }
      signedTransactionSuccess = true;
      // statsData.signed = true;
      // statsData.signedSuccess = true;
      eventBus.emit(EVENTS.TX_SUBMITTING, {});
      try {
        validateGasPriceRange(approvalRes);
        let hash: string | undefined = undefined;
        let reqId: string | undefined = undefined;
        // TODO: customRPC
        // if (RPCService.hasCustomRPC(chain)) {
        if (false) {
          // const txData: any = {
          //   ...approvalRes,
          //   gasLimit: approvalRes.gas,
          //   r: addHexPrefix(signedTx.r),
          //   s: addHexPrefix(signedTx.s),
          //   v: addHexPrefix(signedTx.v),
          // };
          // if (is1559) {
          //   txData.type = '0x2';
          // }
          // const tx = TransactionFactory.fromTxData(txData);
          // const rawTx = covertToHex(tx.serialize());
          // hash = await RPCService.requestCustomRPC(
          //   chain,
          //   'eth_sendRawTransaction',
          //   [rawTx],
          // );
          // onTransactionCreated({ hash, reqId, pushType });
        } else {
          const res = await openapi.submitTx({
            tx: {
              ...approvalRes,
              r: covertToHex(signedTx.r),
              s: covertToHex(signedTx.s),
              v: covertToHex(signedTx.v),
              value: approvalRes.value || '0x0',
            },
            push_type: pushType,
            low_gas_deadline: lowGasDeadline,
            req_id: preReqId || '',
            origin,
          });

          hash = res.req.tx_id || undefined;
          reqId = res.req.id || undefined;
          if (res.req.push_status === 'failed') {
            onTransactionSubmitFailed(new Error('Submit tx failed'));
          } else {
            onTransactionCreated({ hash, reqId, pushType });
            // if (notificationService.statsData?.signMethod) {
            //   statsData.signMethod = notificationService.statsData?.signMethod;
            // }
            // notificationService.setStatsData(statsData);
          }
        }

        return hash;
      } catch (e: any) {
        console.log('submit tx failed', e);
        onTransactionSubmitFailed(e);
      }
    } catch (e) {
      if (!signedTransactionSuccess) {
        // statsData.signed = true;
        // statsData.signedSuccess = false;
      }
      // if (notificationService.statsData?.signMethod) {
      //   statsData.signMethod = notificationService.statsData?.signMethod;
      // }
      // notificationService.setStatsData(statsData);
      throw typeof e === 'object' ? e : new Error(JSON.stringify(e));
    }
  };
  @Reflect.metadata('SAFE', true)
  netVersion = (req: { session: Session }) => {
    return this.ethRpc({
      ...req,
      data: { method: 'net_version', params: [] },
    });
  };

  @Reflect.metadata('SAFE', true)
  web3ClientVersion = () => {
    return `Rabby/${process.env.release}`;
  };

  @Reflect.metadata('APPROVAL', ['ETHSign', () => null, { height: 390 }])
  ethSign = () => {
    throw new Error(
      "Signing with 'eth_sign' can lead to asset loss. For your safety, Rabby does not support this method.",
    );
  };

  @Reflect.metadata('APPROVAL', [
    'SignText',
    ({
      data: {
        params: [_, from],
      },
    }: {
      data: {
        params: string[];
      };
    }) => {
      const currentAddress = preferenceService
        .getCurrentAccount()
        ?.address.toLowerCase();
      if (from.toLowerCase() !== currentAddress)
        throw ethErrors.rpc.invalidParams(
          'from should be same as current address',
        );
    },
  ])
  personalSign = async ({
    data,
    approvalRes,
  }: {
    data: {
      params: SignTypeDataParams;
    };
    approvalRes: ApprovalRes;
  }) => {
    if (!data.params) return;
    const currentAccount = preferenceService.getCurrentAccount()!;
    try {
      const [string, from] = data.params;
      const hex = isHexString(string) ? string : stringToHex(string);
      const keyring = await this._checkAddress(from);
      const result = await keyringService.signPersonalMessage(
        keyring,
        { data: hex, from },
        approvalRes?.extra,
      );
      // TODO
      // signTextHistoryService.createHistory({
      //   address: from,
      //   text: string,
      //   origin: session.origin,
      //   type: 'personalSign',
      // });
      reportSignText({
        account: currentAccount,
        method: 'personalSign',
        success: true,
      });
      return result;
    } catch (e) {
      reportSignText({
        account: currentAccount,
        method: 'personalSign',
        success: false,
      });
      throw e;
    }
  };

  @Reflect.metadata('PRIVATE', true)
  private _signTypedData = async (
    from: string,
    data: string,
    version: string,
    extra?: any,
  ) => {
    let _data = data;
    if (version !== 'V1') {
      if (typeof data === 'string') {
        _data = JSON.parse(data);
      }
    }
    const keyring = await this._checkAddress(from);

    return keyringService.signTypedMessage(
      keyring,
      {
        from,
        data: _data,
      },
      { version, ...(extra || {}) },
    );
  };

  @Reflect.metadata('APPROVAL', ['SignTypedData', v1SignTypedDataVlidation])
  ethSignTypedData = async ({
    data: {
      params: [data, from],
    },
    approvalRes,
  }: {
    data: {
      params: SignTypeDataParams;
    };
    approvalRes: ApprovalRes;
  }) => {
    const currentAccount = preferenceService.getCurrentAccount()!;
    try {
      const result = await this._signTypedData(
        from,
        data,
        'V1',
        approvalRes?.extra,
      );
      // TODO
      // signTextHistoryService.createHistory({
      //   address: from,
      //   text: data,
      //   origin: session.origin,
      //   type: 'ethSignTypedData',
      // });
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedData',
        success: true,
      });
      return result;
    } catch (e) {
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedData',
        success: false,
      });
      throw e;
    }
  };

  @Reflect.metadata('APPROVAL', ['SignTypedData', v1SignTypedDataVlidation])
  ethSignTypedDataV1 = async ({
    data: {
      params: [data, from],
    },
    approvalRes,
  }: {
    data: {
      params: SignTypeDataParams;
    };
    approvalRes: ApprovalRes;
  }) => {
    const currentAccount = preferenceService.getCurrentAccount()!;
    try {
      const result = await this._signTypedData(
        from,
        data,
        'V1',
        approvalRes?.extra,
      );
      // signTextHistoryService.createHistory({
      //   address: from,
      //   text: data,
      //   origin: session.origin,
      //   type: 'ethSignTypedDataV1',
      // });
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedDataV1',
        success: true,
      });
      return result;
    } catch (e) {
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedDataV1',
        success: false,
      });
      throw e;
    }
  };

  @Reflect.metadata('APPROVAL', ['SignTypedData', signTypedDataVlidation])
  ethSignTypedDataV3 = async ({
    data: {
      params: [from, data],
    },
    approvalRes,
  }: {
    data: {
      params: SignTypeDataParams;
    };
    approvalRes: ApprovalRes;
  }) => {
    const currentAccount = preferenceService.getCurrentAccount()!;
    try {
      const result = await this._signTypedData(
        from,
        data,
        'V3',
        approvalRes?.extra,
      );
      // signTextHistoryService.createHistory({
      //   address: from,
      //   text: data,
      //   origin: session.origin,
      //   type: 'ethSignTypedDataV3',
      // });
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedDataV3',
        success: true,
      });
      return result;
    } catch (e) {
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedDataV3',
        success: false,
      });
      throw e;
    }
  };

  @Reflect.metadata('APPROVAL', ['SignTypedData', signTypedDataVlidation])
  ethSignTypedDataV4 = async ({
    data: {
      params: [from, data],
    },
    approvalRes,
  }: {
    data: {
      params: SignTypeDataParams;
    };
    approvalRes: ApprovalRes;
  }) => {
    const currentAccount = preferenceService.getCurrentAccount()!;
    try {
      const result = await this._signTypedData(
        from,
        data,
        'V4',
        approvalRes?.extra,
      );
      // signTextHistoryService.createHistory({
      //   address: from,
      //   text: data,
      //   origin: session.origin,
      //   type: 'ethSignTypedDataV4',
      // });
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedDataV4',
        success: true,
      });
      return result;
    } catch (e) {
      reportSignText({
        account: currentAccount,
        method: 'ethSignTypedDataV4',
        success: false,
      });
      throw e;
    }
  };

  @Reflect.metadata('APPROVAL', [
    'AddChain',
    ({
      data: {
        params: [chainParams],
      },
      session,
    }: {
      data: {
        params: [AddEthereumChainParams];
      };
      session: Session;
    }) => {
      if (!chainParams) {
        throw ethErrors.rpc.invalidParams('params is required but got []');
      }
      if (!chainParams.chainId) {
        throw ethErrors.rpc.invalidParams('chainId is required');
      }
      const connected = dappService.getConnectedDapp(session.origin);
      if (connected) {
        if (Number(chainParams.chainId) === CHAINS[connected.chainId].id) {
          return true;
        }
      }
    },
    { height: 650 },
  ])
  walletAddEthereumChain = ({
    data: {
      params: [chainParams],
    },
    session: { origin },
    approvalRes,
  }: {
    data: {
      params: AddEthereumChainParams[];
    };
    session: {
      origin: string;
    };
    approvalRes?: {
      chain: CHAINS_ENUM;
      rpcUrl: string;
    };
  }) => {
    let chainId = chainParams.chainId;
    if (typeof chainId === 'number') {
      chainId = intToHex(chainId).toLowerCase();
    } else {
      chainId = chainId.toLowerCase();
    }
    const chain = Object.values(CHAINS).find(value =>
      new BigNumber(value.hex).isEqualTo(chainId),
    );

    if (!chain) {
      throw new Error('This chain is not supported by Rabby yet.');
    }

    if (approvalRes) {
      // RPCService.setRPC(approvalRes.chain, approvalRes.rpcUrl);
    }

    const connectSite = dappService.getConnectedDapp(origin);
    const prev = connectSite ? CHAINS[connectSite.chainId] : undefined;
    if (!connectSite) {
      return;
    }
    dappService.updateDapp({
      ...connectSite,
      chainId: chain.enum,
    });

    // rabby:chainChanged event must be sent before chainChanged event
    // TODO: sessionService
    // sessionService.broadcastEvent(
    //   'rabby:chainChanged',
    //   {
    //     ...chain,
    //     prev,
    //   },
    //   origin,
    // );
    // sessionService.broadcastEvent(
    //   'chainChanged',
    //   {
    //     chain: chain.hex,
    //     networkVersion: chain.network,
    //   },
    //   origin,
    // );
    return null;
  };

  @Reflect.metadata('APPROVAL', [
    'AddChain',
    ({
      data,
      session,
    }: {
      data: {
        params: [AddEthereumChainParams];
      };
      session: Session;
    }) => {
      if (!data.params[0]) {
        throw ethErrors.rpc.invalidParams('params is required but got []');
      }
      if (!data.params[0]?.chainId) {
        throw ethErrors.rpc.invalidParams('chainId is required');
      }
      const connected = dappService.getConnectedDapp(session.origin);
      if (connected) {
        const { chainId } = data.params[0];
        if (Number(chainId) === CHAINS[connected.chainId].id) {
          return true;
        }
      }
    },
    { height: 650 },
  ])
  walletSwitchEthereumChain = ({
    data: {
      params: [chainParams],
    },
    session: { origin },
  }: {
    data: {
      params: [AddEthereumChainParams];
    };
    session: Session;
  }) => {
    let chainId = chainParams.chainId;
    if (typeof chainId === 'number') {
      chainId = intToHex(chainId).toLowerCase();
    } else {
      chainId = chainId.toLowerCase();
    }
    const chain = Object.values(CHAINS).find(value =>
      new BigNumber(value.hex).isEqualTo(chainId),
    );

    if (!chain) {
      throw new Error('This chain is not supported by Rabby yet.');
    }

    const connectSite = dappService.getConnectedDapp(origin);
    const prev = connectSite ? CHAINS[connectSite.chainId] : undefined;

    if (!connectSite) {
      return;
    }
    dappService.updateDapp({
      ...connectSite,
      chainId: chain.enum,
    });

    // rabby:chainChanged event must be sent before chainChanged event
    // TODO: sessionService
    // sessionService.broadcastEvent(
    //   'rabby:chainChanged',
    //   {
    //     ...chain,
    //     prev,
    //   },
    //   origin,
    // );
    // sessionService.broadcastEvent(
    //   'chainChanged',
    //   {
    //     chain: chain.hex,
    //     networkVersion: chain.network,
    //   },
    //   origin,
    // );
    return null;
  };

  @Reflect.metadata('APPROVAL', ['AddAsset', () => null, { height: 600 }])
  walletWatchAsset = ({
    approvalRes,
  }: {
    approvalRes: { id: string; chain: string };
  }) => {
    const { id, chain } = approvalRes;
    preferenceService.addCustomizedToken({
      address: id,
      chain,
    });
  };

  walletRequestPermissions = ({
    data: { params: permissions },
  }: {
    data: {
      params: any[];
    };
  }) => {
    const result: Web3WalletPermission[] = [];
    if (permissions && 'eth_accounts' in permissions[0]) {
      result.push({ parentCapability: 'eth_accounts' });
    }
    return result;
  };

  @Reflect.metadata('SAFE', true)
  walletGetPermissions = ({ session: { origin } }: { session: Session }) => {
    const result: Web3WalletPermission[] = [];
    if (keyringService.isUnlocked() && dappService.getConnectedDapp(origin)) {
      result.push({ parentCapability: 'eth_accounts' });
    }
    return result;
  };

  personalEcRecover = ({
    data: {
      params: [data, sig, extra = {}],
    },
  }: {
    data: {
      params: [string, string, any];
    };
  }) => {
    return recoverPersonalSignature({
      ...extra,
      data,
      sig,
    });
  };

  @Reflect.metadata('SAFE', true)
  netListening = () => {
    return true;
  };

  @Reflect.metadata('PRIVATE', true)
  private _checkAddress = async (address: string) => {
    // eslint-disable-next-line prefer-const
    let { address: currentAddress, type } =
      (await this.getCurrentAccount()) || {};
    currentAddress = currentAddress?.toLowerCase();
    if (
      !currentAddress ||
      currentAddress !== normalizeAddress(address)?.toLowerCase()
    ) {
      throw ethErrors.rpc.invalidParams({
        message:
          'Invalid parameters: must use the current user address to sign',
      });
    }
    const keyring = await keyringService.getKeyringForAccount(
      currentAddress,
      type,
    );

    return keyring;
  };
  // TODO: not support for now
  // @Reflect.metadata('APPROVAL', [
  //   'GetPublicKey',
  //   ({
  //     data: {
  //       params: [address],
  //     },
  //     session: { origin },
  //   }) => {
  //     const account = preferenceService.getCurrentAccount();

  //     if (address?.toLowerCase() !== account?.address?.toLowerCase()) {
  //       throw ethErrors.rpc.invalidParams({
  //         message:
  //           'Invalid parameters: must use the current user address to sign',
  //       });
  //     }
  //   },
  //   { height: 390 },
  // ])
  // ethGetEncryptionPublicKey = async ({
  //   data: {
  //     params: [address],
  //   },
  //   session: { origin },
  //   approvalRes,
  // }) => {
  //   return approvalRes?.data;
  // };

  // @Reflect.metadata('APPROVAL', [
  //   'Decrypt',
  //   ({
  //     data: {
  //       params: [message, address],
  //     },
  //     session: { origin },
  //   }) => {
  //     return null;
  //   },
  // ])
  // ethDecrypt = async ({
  //   data: {
  //     params: [message, address],
  //   },
  //   session: { origin },
  //   approvalRes,
  // }) => {
  //   return approvalRes.data;
  // };

  ethGetTransactionByHash = async (req: ControllerParams<string[]>) => {
    const {
      data: {
        params: [hash],
      },
    } = req;
    // const tx = transactionHistoryService.getPendingTxByHash(hash);
    // if (tx) return formatTxMetaForRpcResult(tx);
    return this.ethRpc({
      ...req,
      data: { method: 'eth_getTransactionByHash', params: [hash] },
    });
  };

  // TODO: support import address
  // @Reflect.metadata('APPROVAL', [
  //   'ImportAddress',
  //   ({ data }) => {
  //     if (!data.params[0]) {
  //       throw ethErrors.rpc.invalidParams('params is required but got []');
  //     }
  //     if (!data.params[0]?.chainId) {
  //       throw ethErrors.rpc.invalidParams('chainId is required');
  //     }
  //   },
  //   { height: 628 },
  // ])
  // walletImportAddress = async () => {
  //   return null;
  // };
}

export default new ProviderController();
