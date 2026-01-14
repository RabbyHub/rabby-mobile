import {
  AuthorizationList,
  AuthorizationListBytes,
  AuthorizationListItem,
  Common,
  Hardfork,
} from '@ethereumjs/common';
import { FeeMarketEIP1559TxData, TransactionFactory } from '@ethereumjs/tx';
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
  notificationService,
  swapService,
  customTestnetService,
  bridgeService,
  customRPCService,
  gasAccountService,
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
import { CHAINS_ENUM } from '@/constant/chains';
import { SAFE_RPC_METHODS } from '@/constant/rpc';
import BaseController from './base';
import { Account } from '../services/preference';
import BigNumber from 'bignumber.js';
// import { formatTxMetaForRpcResult } from 'background/utils/tx';
import { findChain, findChainByEnum } from '@/utils/chain';
import { is1559Tx, is7702Tx, validateGasPriceRange } from '@/utils/transaction';
import { eventBus, EVENTS } from '@/utils/events';
import { sessionService } from '../services/shared';
import { BroadcastEvent } from '@/constant/event';
import { createDappBySession } from '../apis/dapp';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { matomoRequestEvent } from '@/utils/analytics';
import { stats } from '@/utils/stats';
import { StatsData } from '../services/notification';
import { ethers } from 'ethers';
import { getGlobalProvider } from '../apis/globalProvider';
import { bytesToHex } from '@ethereumjs/util';
import { CustomTestnetTokenBase } from '../services/customTestnetService';
// import { updateExpiredTime } from '@/databases/sync/assets';
import { PENDGING_TIME } from '@/constant/expireTime';
import { isString } from 'lodash';
import { updateExpiredTime } from '@/databases/sync/utils';
import { assertProviderRequest } from '../utils/assertProviderRequest';
import { ProviderRequest } from './type';
import { hexToNumber, isAddress, toHex } from 'viem';
import { add0x } from '@/utils/address';
import { removeLeadingZeroes } from '@/utils/7702';
// import eventBus from '@/eventBus';

const SIGN_TIMEOUT = 100;

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
  stats.report('completeSignText', {
    type: account.brandName,
    category: KEYRING_CATEGORY_MAP[account.type],
    method,
    success,
  });
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
  isGasLess?: boolean;
  isGasAccount?: boolean;
  logId?: string;
  sig?: string;
  $account?: Account;
  authorizationList?: AuthorizationListBytes | AuthorizationList | never;
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
  account,
}: {
  data: {
    params: SignTypeDataParams;
  };
  account?: Account | null;
}) => {
  const currentAddress = account?.address?.toLowerCase();
  if (from.toLowerCase() !== currentAddress)
    throw ethErrors.rpc.invalidParams('from should be same as current address');
};

const signTypedDataVlidation = ({
  data: {
    params: [from, data],
  },
  session,
  account,
}: {
  data: {
    params: SignTypeDataParams;
  };
  session: Session;
  account?: Account | null;
}) => {
  let jsonData;
  try {
    jsonData = JSON.parse(data);
  } catch (e) {
    throw ethErrors.rpc.invalidParams('data is not a validate JSON string');
  }
  if (!dappService.isInternalDapp(session.origin)) {
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
  }
  const currentAddress = account?.address.toLowerCase();
  if (from?.toLowerCase() !== currentAddress)
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
      account?: Account;
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
    let chainServerId = findChain({ enum: CHAINS_ENUM.ETH })!.serverId;
    if (site) {
      chainServerId =
        findChain({ enum: site.chainId })?.serverId || chainServerId;
    }
    if (forceChainServerId) {
      chainServerId = forceChainServerId;
    }

    const currentAddress = req?.account?.address.toLowerCase() || '0x';
    const cache = RpcCache.get(currentAddress, {
      method,
      params,
      chainId: chainServerId,
    });
    if (cache) {
      return cache;
    }

    const chain = findChain({
      serverId: chainServerId,
    })!;
    if (!chain?.isTestnet) {
      if (customRPCService.hasCustomRPC(chain.enum)) {
        const promise = customRPCService
          .requestCustomRPC(chain.enum, method, params)
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
      } else {
        const promise = customRPCService
          .defaultEthRPC({
            chainServerId,
            origin,
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
    } else {
      const client = customTestnetService.getClient(chain.id);
      return client.request({ method: method as any, params: params as any });
    }
  };

  ethRequestAccounts = async (req: { session: Session; account?: Account }) => {
    const {
      session: { origin },
    } = req;
    console.log(req);
    assertProviderRequest(req as any);
    if (!dappService.getDapp(origin)?.isConnected) {
      throw ethErrors.provider.unauthorized();
    }

    const _account = req.account;
    const account = _account ? [_account.address.toLowerCase()] : [];

    sessionService.broadcastEvent(
      BroadcastEvent.accountsChanged,
      account,
      origin,
    );
    const connectSite = dappService.getConnectedDapp(origin);

    if (connectSite) {
      const chain = findChain({
        enum: connectSite.chainId,
      });
      if (chain) {
        // // rabby:chainChanged event must be sent before chainChanged event
        // sessionService.broadcastEvent('rabby:chainChanged', chain, origin);
        sessionService.broadcastEvent(
          BroadcastEvent.chainChanged,
          {
            chainId: chain.hex,
            networkVersion: chain.network,
          },
          origin,
        );
      }
    }

    return account;
  };

  @Reflect.metadata('SAFE', true)
  ethAccounts = async ({
    session: { origin },
    account,
  }: {
    session: Session;
    account?: Account;
  }) => {
    if (
      !dappService.getDapp(origin)?.isConnected ||
      !keyringService.isUnlocked()
    ) {
      return [];
    }

    return account ? [account.address.toLowerCase()] : [];
  };

  ethCoinbase = async ({
    session: { origin },
    account,
  }: {
    session: Session;
    account?: Account;
  }) => {
    if (!dappService.getDapp(origin)?.isConnected) {
      return null;
    }

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
    (req: ProviderRequest) => {
      assertProviderRequest(req);
      const {
        data: {
          params: [tx],
        },
        session,
        account,
      } = req;
      const currentAddress = account?.address?.toLowerCase();
      const currentChain = dappService.isInternalDapp(session.origin)
        ? findChain({ id: tx.chainId })!.enum
        : dappService.getConnectedDapp(session.origin)?.chainId;
      if (tx.from.toLowerCase() !== currentAddress) {
        throw ethErrors.rpc.invalidParams(
          'from should be same as current address',
        );
      }
      if (
        'chainId' in tx &&
        (!currentChain ||
          Number(tx.chainId) !== findChain({ enum: currentChain })?.id)
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
    account: Account;
  }) => {
    assertProviderRequest(options as any);
    if (options.pushed) {
      return options.result;
    }
    const {
      data: {
        params: [txParams],
      },
      session: { origin },
      approvalRes,
      account,
    } = cloneDeep(options);
    const currentAccount = account;
    const keyring = await this._checkAddress(txParams.from, options);
    const isSend = !!txParams.isSend;
    const isSpeedUp = !!txParams.isSpeedUp;
    const isCancel = !!txParams.isCancel;
    const extra = approvalRes.extra;
    const signingTxId = approvalRes.signingTxId;
    const isCoboSafe = !!txParams.isCoboSafe;
    const pushType = approvalRes.pushType || 'default';
    const lowGasDeadline = approvalRes.lowGasDeadline;
    const preReqId = approvalRes.reqId;
    const isGasLess = approvalRes.isGasLess || false;
    const sig = approvalRes.sig;
    const logId = approvalRes?.logId || '';
    const isGasAccount = approvalRes.isGasAccount || false;

    const eip7702Revoke = options?.data?.$ctx?.eip7702Revoke || false;
    const eip7702RevokeAuthorization =
      options?.data?.$ctx?.eip7702RevokeAuthorization || [];

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
    delete approvalRes.isGasLess;
    delete approvalRes.isGasAccount;
    delete approvalRes.sig;
    delete approvalRes.$account;

    let is1559 = is1559Tx(approvalRes);
    const is7702 = is7702Tx(approvalRes);

    if (is7702 && !(eip7702Revoke || isSpeedUp)) {
      throw new Error('not support 7702');
    }

    if (
      is1559 &&
      approvalRes.maxFeePerGas === approvalRes.maxPriorityFeePerGas &&
      !eip7702Revoke &&
      !is7702
    ) {
      // fallback to legacy transaction if maxFeePerGas is equal to maxPriorityFeePerGas
      approvalRes.gasPrice = approvalRes.maxFeePerGas;
      delete approvalRes.maxFeePerGas;
      delete approvalRes.maxPriorityFeePerGas;
      is1559 = false;
    }
    const common = Common.custom(
      { chainId: approvalRes.chainId },
      { hardfork: Hardfork.Prague, eips: [7702] },
    );
    const txData = { ...approvalRes, gasLimit: approvalRes.gas };
    if (is1559) {
      txData.type = '0x2';
    }
    if (
      (is7702 && isSpeedUp) ||
      (eip7702Revoke && eip7702RevokeAuthorization?.length)
    ) {
      txData.type = '0x4';

      if (!isSpeedUp) {
        const authorizationList = [] as AuthorizationListItem[];

        for (const authorization of eip7702RevokeAuthorization) {
          const signature: string =
            await keyringService.signEip7702Authorization(keyring, {
              from: txParams.from,
              authorization: authorization,
            });
          const r = signature.slice(0, 66) as `0x${string}`;
          const s = add0x(signature.slice(66, 130));
          const v = parseInt(signature.slice(130, 132), 16);
          const yParity = toHex(v - 27 === 0 ? 0 : 1);
          authorizationList.push({
            chainId: toHex(authorization[0]),
            address: authorization[1],
            nonce: toHex(authorization[2]),
            r: removeLeadingZeroes(r),
            s: removeLeadingZeroes(s),
            yParity: removeLeadingZeroes(yParity),
          } as any);
        }
        txData.authorizationList = authorizationList;
        approvalRes.authorizationList = authorizationList;
      }

      // bsc use gasPrice
      if (!txData.maxFeePerGas || !txData.maxPriorityFeePerGas) {
        txData.maxFeePerGas = txData.maxFeePerGas || txData.gasPrice;
        txData.maxPriorityFeePerGas =
          txData.maxPriorityFeePerGas || txData.gasPrice;
        delete txData.gasPrice;
      }

      if (!approvalRes.maxFeePerGas || !approvalRes.maxPriorityFeePerGas) {
        approvalRes.maxFeePerGas =
          approvalRes.maxFeePerGas || approvalRes.gasPrice;
        approvalRes.maxPriorityFeePerGas =
          approvalRes.maxPriorityFeePerGas || approvalRes.gasPrice;
        delete approvalRes.gasPrice;
      }
    }
    const tx = TransactionFactory.fromTxData(txData as FeeMarketEIP1559TxData, {
      common,
    });
    let opts;
    opts = extra;
    if (currentAccount.type === KEYRING_TYPE.GnosisKeyring) {
      const buildinProvider = getGlobalProvider();
      if (!buildinProvider?.currentProvider) {
        throw new Error('buildinProvider not found');
      }
      buildinProvider.currentProvider.currentAccount =
        approvalRes!.account!.address;
      buildinProvider.currentProvider.currentAccountType =
        approvalRes!.account!.type;
      buildinProvider.currentProvider.currentAccountBrand =
        approvalRes!.account!.brandName;
      try {
        const provider = new ethers.providers.Web3Provider(
          buildinProvider.currentProvider,
        );
        opts = {
          provider,
        };
      } catch (e) {
        console.log(e);
      }
    }
    const chain = dappService.isInternalDapp(origin)
      ? findChain({ id: approvalRes.chainId })!.enum
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

    const statsData: StatsData = {
      signed: false,
      signedSuccess: false,
      submit: false,
      submitSuccess: false,
      type: currentAccount.brandName,
      chainId: chainItem?.serverId || '',
      category: KEYRING_CATEGORY_MAP[currentAccount.type],
      preExecSuccess: cacheExplain
        ? cacheExplain.pre_exec?.success && cacheExplain.calcSuccess
        : true,
      createdBy: options?.data?.$ctx?.ga ? 'rabby' : 'dapp',
      source: options?.data?.$ctx?.ga?.source || '',
      trigger: options?.data?.$ctx?.ga?.trigger || '',
      reported: false,
    };

    let signedTx;
    try {
      signedTx = await keyringService.signTransaction(
        keyring,
        tx,
        txParams.from,
        opts,
      );
    } catch (e: any) {
      const errObj =
        typeof e === 'object'
          ? { message: e.message }
          : ({ message: e } as any);
      errObj.method = EVENTS.COMMON_HARDWARE.REJECTED;

      throw errObj;
    }

    const txDataWithRSV: any = {
      ...txData,
      r: addHexPrefix(signedTx.r),
      s: addHexPrefix(signedTx.s),
      v: addHexPrefix(signedTx.v),
    };

    try {
      if (
        currentAccount.type === KEYRING_TYPE.GnosisKeyring
        // ||
        // currentAccount.type === KEYRING_TYPE.CoboArgusKeyring
      ) {
        signedTransactionSuccess = true;
        statsData.signed = true;
        statsData.signedSuccess = true;
        return;
      }

      const onTransactionCreated = (info: {
        hash?: string;
        reqId?: string;
        pushType?: TxPushType;
      }) => {
        const { hash, reqId, pushType = 'default' } = info;
        if (
          options?.data?.$ctx?.stats?.afterSign?.length &&
          Array.isArray(options?.data?.$ctx?.stats?.afterSign)
        ) {
          options.data.$ctx.stats.afterSign.forEach(({ name, params }) => {
            if (name && params) {
              stats.report(name, params);
            }
          });
        }

        const { r, s, v, ...other } = approvalRes;
        if (hash) {
          swapService.postSwap(chain, hash, other);
          bridgeService.postBridge(chain, hash, other);
        }

        statsData.submit = true;
        statsData.submitSuccess = true;
        // if (isSend) {
        //   pageStateCacheService.clear();
        // }
        const _rawTx = {
          ...rawTx,
          ...approvalRes,
          r: covertToHex(signedTx.r),
          s: covertToHex(signedTx.s),
          v: covertToHex(signedTx.v),
        };
        if (is1559) {
          delete _rawTx.gasPrice;
        } else {
          delete _rawTx.maxPriorityFeePerGas;
          delete _rawTx.maxFeePerGas;
        }
        updateExpiredTime(txParams.from, PENDGING_TIME);

        // TODO: transactionHistory
        transactionHistoryService.addTx({
          address: txParams.from,
          nonce: +approvalRes.nonce,
          chainId: approvalRes.chainId,

          rawTx: _rawTx,
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
          $ctx: options?.data?.$ctx,
          keyringType: currentAccount.type,
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
            chainId: findChain({ enum: chain })!.id,
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
          options.data.$ctx.stats.afterSign.forEach(({ name, params }) => {
            if (name && params) {
              stats.report(name, params);
            }
          });
        }

        stats.report('submitTransaction', {
          type: currentAccount.brandName,
          chainId: chainItem?.serverId || '',
          category: KEYRING_CATEGORY_MAP[currentAccount.type],
          success: false,
          preExecSuccess: cacheExplain
            ? cacheExplain.pre_exec?.success && cacheExplain.calcSuccess
            : true,
          createdBy: options?.data?.$ctx?.ga ? 'rabby' : 'dapp',
          source: options?.data?.$ctx?.ga?.source || '',
          trigger: options?.data?.$ctx?.ga?.trigger || '',
        });
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
        const errMsg = e.details || e.message || JSON.stringify(e);
        if (notificationService.statsData?.signMethod) {
          statsData.signMethod = notificationService.statsData?.signMethod;
        }
        notificationService.setStatsData(statsData);
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
          statsData.signed = true;
          statsData.signedSuccess = true;
        }
        if (notificationService.statsData?.signMethod) {
          statsData.signMethod = notificationService.statsData?.signMethod;
        }
        notificationService.setStatsData(statsData);
        return signedTx;
      }

      // const buildTx = TransactionFactory.fromTxData({
      //   ...approvalRes,
      //   r: addHexPrefix(signedTx.r),
      //   s: addHexPrefix(signedTx.s),
      //   v: addHexPrefix(signedTx.v),
      //   type: is1559 ? '0x2' : '0x0',
      // });

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
      statsData.signed = true;
      statsData.signedSuccess = true;
      eventBus.emit(EVENTS.TX_SUBMITTING, {});
      try {
        validateGasPriceRange(approvalRes);
        let hash: string | undefined = undefined;
        let reqId: string | undefined = undefined;
        if (!findChain({ enum: chain })?.isTestnet) {
          if (customRPCService.hasCustomRPC(chain)) {
            const tx = TransactionFactory.fromTxData(txDataWithRSV, { common });

            const rawTx = bytesToHex(tx.serialize());
            hash = await customRPCService.requestCustomRPC(
              chain,
              'eth_sendRawTransaction',
              [rawTx],
            );
            onTransactionCreated({ hash, reqId, pushType });
          } else {
            const chainServerId = findChain({ enum: chain })!.serverId;
            const params: Parameters<typeof openapi.submitTxV2>[0] = {
              context: {
                tx: {
                  ...approvalRes,
                  r: covertToHex(signedTx.r),
                  s: covertToHex(signedTx.s),
                  v: covertToHex(signedTx.v),
                  value: approvalRes.value || '0x0',
                },
                origin,
                log_id: logId,
              },
              backend_push_require: {
                gas_type: isGasAccount
                  ? 'gas_account'
                  : isGasLess
                  ? 'gasless'
                  : null,
              },
              sig,
              mev_share_model: pushType === 'mev' ? 'user' : 'rabby',
            };

            const adoptBE7702Params = () => {
              if (
                approvalRes.authorizationList &&
                approvalRes.authorizationList?.some(e => e.yParity)
              ) {
                params.context.tx = {
                  ...params.context.tx,
                  authorizationList: approvalRes.authorizationList.map(e => ({
                    chainId: hexToNumber(e.chainId),
                    address: e.address,
                    nonce: e.nonce,
                    r: e.r,
                    s: e.s,
                    v: e.yParity,
                  })),
                } as any;
              }
            };

            const defaultRPC = customRPCService.getDefaultRPC(chainServerId);

            if (defaultRPC?.txPushToRPC && !isGasLess && !isGasAccount) {
              let fePushedFailed = false;

              const tx = TransactionFactory.fromTxData(txDataWithRSV);
              const rawTx = bytesToHex(tx.serialize());

              try {
                const [fePushedHash, url] =
                  await customRPCService.defaultRPCSubmitTxWithFallback(
                    chainServerId,
                    'eth_sendRawTransaction',
                    [rawTx],
                  );

                hash = fePushedHash;

                console.log('push tx id', fePushedHash);

                params.frontend_push_result = {
                  success: true,
                  has_pushed: true,
                  raw_tx: rawTx,
                  url,
                  return_tx_id: fePushedHash!,
                };

                openapi.submitTxV2(params).catch(error => {
                  console.log('ignore BE error', error);
                });
              } catch (fePushError) {
                fePushedFailed = true;
                const urls =
                  customRPCService.getDefaultRPCByChainServerId(chainServerId);
                params.frontend_push_result = {
                  success: false,
                  has_pushed: true,
                  url: urls?.rpcUrl?.[0] || '',
                  error_msg:
                    typeof fePushError === 'object'
                      ? (fePushError as any)?.message
                      : String(fePushError),
                };
              }
              if (fePushedFailed) {
                adoptBE7702Params();
                const res = await openapi.submitTxV2(params);
                hash = res?.tx_id;
              }
            } else {
              adoptBE7702Params();
              const res = await openapi.submitTxV2(params);
              if (res.access_token) {
                gasAccountService.setGasAccountSig(
                  res.access_token,
                  currentAccount,
                );
                eventBus.emit(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, null);
              }
              hash = res?.tx_id;
            }

            //No more low gas push, reqId is no longer required.
            reqId = undefined;

            if (!hash) {
              onTransactionSubmitFailed(new Error('Submit tx failed'));
            } else {
              onTransactionCreated({ hash, reqId, pushType });
              if (notificationService.statsData?.signMethod) {
                statsData.signMethod =
                  notificationService.statsData?.signMethod;
              }
              notificationService.setStatsData(statsData);
            }
          }
        } else {
          const chainData = findChain({
            enum: chain,
          })!;
          const tx = TransactionFactory.fromTxData(txDataWithRSV, { common });
          const rawTx = bytesToHex(tx.serialize());
          const client = customTestnetService.getClient(chainData.id);

          hash = await client?.request({
            method: 'eth_sendRawTransaction',
            params: [rawTx as any],
          });
          onTransactionCreated({ hash, reqId, pushType });
          notificationService.setStatsData(statsData);
        }

        return hash;
      } catch (e: any) {
        console.log('submit tx failed', e);
        onTransactionSubmitFailed(e);
      }
    } catch (e) {
      if (!signedTransactionSuccess) {
        statsData.signed = true;
        statsData.signedSuccess = false;
      }
      if (notificationService.statsData?.signMethod) {
        statsData.signMethod = notificationService.statsData?.signMethod;
      }
      notificationService.setStatsData(statsData);
      if ('details' in (e as any)) {
        throw new Error((e as any).details);
      } else {
        throw typeof e === 'object' ? e : new Error(JSON.stringify(e));
      }
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
    req => {
      assertProviderRequest(req);
      const {
        data: {
          params: [_, from],
        },
        account,
      } = req;
      const currentAddress = account.address.toLowerCase();
      if (from.toLowerCase() !== currentAddress)
        throw ethErrors.rpc.invalidParams(
          'from should be same as current address',
        );
    },
  ])
  personalSign = async (req: {
    data: {
      params: SignTypeDataParams;
    };
    session: Session;
    account: Account;
    approvalRes: Pick<ApprovalRes, 'extra'>;
  }) => {
    assertProviderRequest(req as any);
    const { data, approvalRes, account: currentAccount } = req;
    if (!data.params) return;
    if (
      currentAccount.type === KEYRING_TYPE.GnosisKeyring &&
      isString(approvalRes)
    ) {
      return approvalRes;
    }
    try {
      const [string, from] = data.params;
      const hex = isHexString(string) ? string : stringToHex(string);
      const keyring = await this._checkAddress(from, req);
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
    {
      from,
      data,
      version,
      extra,
    }: {
      from: string;
      data: any;
      version: string;
      extra: any;
    },
    req: ProviderRequest,
  ) => {
    const keyring = await this._checkAddress(from, req);
    let _data = data;
    if (version !== 'V1') {
      if (typeof data === 'string') {
        _data = JSON.parse(data);
      }
    }

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
  ethSignTypedData = async req => {
    const {
      data: {
        params: [data, from],
      },
      session,
      approvalRes,
    } = req;
    assertProviderRequest(req);
    const currentAccount = req.account;
    if (
      currentAccount.type === KEYRING_TYPE.GnosisKeyring &&
      isString(approvalRes)
    ) {
      return approvalRes;
    }
    try {
      const result = await this._signTypedData(
        {
          from,
          data,
          version: 'V1',
          extra: approvalRes?.extra,
        },
        req,
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
  ethSignTypedDataV1 = async req => {
    assertProviderRequest(req);
    const {
      data: {
        params: [data, from],
      },
      approvalRes,
      account,
    } = req;
    const currentAccount = account;
    if (
      currentAccount.type === KEYRING_TYPE.GnosisKeyring &&
      isString(approvalRes)
    ) {
      return approvalRes;
    }
    try {
      const result = await this._signTypedData(
        {
          from,
          data,
          version: 'V1',
          extra: approvalRes?.extra,
        },
        req,
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
  ethSignTypedDataV3 = async req => {
    assertProviderRequest(req);
    const {
      data: {
        params: [from, data],
      },
      session,
      approvalRes,
      account: currentAccount,
    } = req;
    if (
      currentAccount.type === KEYRING_TYPE.GnosisKeyring &&
      isString(approvalRes)
    ) {
      return approvalRes;
    }
    try {
      const result = await this._signTypedData(
        {
          from,
          data,
          version: 'V3',
          extra: approvalRes?.extra,
        },
        req,
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
  ethSignTypedDataV4 = async req => {
    const {
      data: {
        params: [from, data],
      },
      session,
      approvalRes,
      account: currentAccount,
    } = req;
    assertProviderRequest(req);
    if (
      currentAccount.type === KEYRING_TYPE.GnosisKeyring &&
      isString(approvalRes)
    ) {
      return approvalRes;
    }
    try {
      const result = await this._signTypedData(
        {
          from,
          data,
          version: 'V4',
          extra: approvalRes?.extra,
        },
        req,
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
    }) => {
      if (!chainParams) {
        throw ethErrors.rpc.invalidParams('params is required but got []');
      }
      if (!chainParams.chainId) {
        throw ethErrors.rpc.invalidParams('chainId is required');
      }
      const connected = dappService.getConnectedDapp(session.origin);

      if (connected) {
        // if rabby supported this chain, do not show popup
        if (findChain({ id: chainParams.chainId })) {
          return true;
        }
      }
    },
    // { height: 650 },
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
      chainId = `0x${new BigNumber(chainId).toString(16).toLowerCase()}`;
    }

    const chain = findChain({
      hex: chainId,
    });

    if (!chain) {
      throw new Error('This chain is not supported by Rabby yet.');
    }

    if (approvalRes) {
      // RPCService.setRPC(approvalRes.chain, approvalRes.rpcUrl);
    }

    const connectSite = dappService.getConnectedDapp(origin);
    const prev = connectSite
      ? findChain({ enum: connectSite.chainId })
      : undefined;
    if (!connectSite) {
      return;
    }

    dappService.updateDapp({
      ...connectSite,
      chainId: chain.enum,
    });

    sessionService.broadcastEvent(
      BroadcastEvent.chainChanged,
      {
        chainId: chain.hex,
        networkVersion: chain.network,
      },
      origin,
    );
    return null;
  };

  @Reflect.metadata('APPROVAL', [
    'SwitchChain',
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
        if (
          findChain({
            id: +chainId,
          })
        ) {
          return true;
        }
        throw ethErrors.provider.custom({
          code: 4902,
          message: `Unrecognized chain ID "${chainId}". Try adding the chain using wallet_switchEthereumChain first.`,
        });
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
    const chain = findChain({ hex: chainId });

    if (!chain) {
      throw ethErrors.provider.custom({
        code: 4902,
        message: `Unrecognized chain ID "${chainId}". Try adding the chain using wallet_switchEthereumChain first.`,
      });
    }

    const connectSite = dappService.getConnectedDapp(origin);
    const prev = connectSite
      ? findChain({ enum: connectSite.chainId })
      : undefined;

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
    sessionService.broadcastEvent(
      BroadcastEvent.chainChanged,
      {
        chainId: chain.hex,
        networkVersion: chain.network,
      },
      origin,
    );

    return null;
  };

  @Reflect.metadata('APPROVAL', [
    'AddAsset',
    ({ data, session }) => {
      if (!data.params) {
        throw ethErrors.rpc.invalidParams('params is required');
      }
      if (!data.params.type) {
        throw ethErrors.rpc.invalidParams('Asset type is required');
      }
      if (
        !data.params.options?.address ||
        !isAddress(data.params.options?.address, {
          strict: false,
        })
      ) {
        throw ethErrors.rpc.invalidParams(
          `Invalid address '${data.params.options?.address}'.`,
        );
      }
      return null;
    },
    { height: 600 },
  ])
  walletWatchAsset = ({
    approvalRes,
  }: {
    approvalRes: { id: string; chain: string } & CustomTestnetTokenBase;
  }) => {
    const { id, chain, chainId, symbol, decimals } = approvalRes;
    const chainInfo = findChain({
      serverId: chain,
    });
    if (chainInfo?.isTestnet) {
      customTestnetService.addToken({
        chainId,
        symbol,
        decimals,
        id,
      });
    } else {
      preferenceService.addCustomizedToken({
        address: id,
        chain,
      });
    }
  };

  walletRequestPermissions = ({
    data: { params: permissions },
  }: {
    data: {
      params: any[];
    };
  }) => {
    const result: Web3WalletPermission[] = [];
    if (permissions && 'eth_accounts' in (permissions[0] || {})) {
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

  /**
   * https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-2.md
   */
  @Reflect.metadata('SAFE', true)
  walletRevokePermissions = ({ session: { origin }, data: { params } }) => {
    if (keyringService.isUnlocked() && dappService.getConnectedDapp(origin)) {
      if (params?.[0] && 'eth_accounts' in params[0]) {
        sessionService.broadcastEvent(
          BroadcastEvent.accountsChanged,
          [],
          origin,
        );
        dappService.disconnect(origin);
      }
    }
    return null;
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
  private _checkAddress = async (address: string, req: any) => {
    // eslint-disable-next-line prefer-const
    let { address: currentAddress, type } = req.account || {};
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

  ethGetTransactionReceipt = async req => {
    try {
      const res = await this.ethRpc(req);
      return res;
    } catch (e: any) {
      const idxKeyPhrases = ['index', 'progress'];
      if (idxKeyPhrases.some(phrase => e.message?.includes(phrase))) {
        return null;
      } else {
        throw e;
      }
    }
  };
}

export default new ProviderController();
