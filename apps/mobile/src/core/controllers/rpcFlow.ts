import { ethErrors } from 'eth-rpc-errors';
import {
  getApprovalProbeErrorMessage,
  recordApprovalProbe,
  shouldLogApprovalProbeMethod,
} from '@/debug/approvalProbe';
// import {
//   keyringService,
//   notificationService,
//   permissionService,
// } from 'background/service';
import PromiseFlow from '@/utils/promiseFlow';
// import eventBus from '@/eventBus';
import * as Sentry from '@sentry/react-native';
// import stats from '@/stats';
import { addHexPrefix, stripHexPrefix } from 'ethereumjs-util';
import { eventBus, EVENTS } from '@/utils/events';
import { Chain, CHAINS_ENUM } from '@/constant/chains';
import * as apisDapp from '../apis/dapp';
import { stats } from '@/utils/stats';
import { waitSignComponentAmounted } from '../utils/signEvent';
import { findChain } from '@/utils/chain';
import { gnosisController } from './gnosisController';
import { underline2Camelcase } from '../utils/common';
import { getRetryTxRecommendNonce, getRetryTxType } from '@/utils/errorTxRetry';
import { hexToNumber, isHex } from 'viem';
import { intToHex } from '@/utils/number';
import BigNumber from 'bignumber.js';
import { selectDappAccount } from '@/core/dapp/accountSelector';
import { getAccountList } from '../apis/account';
import { shouldAutoConnect, shouldAutoPersonalSign } from './autoConnect';
import { openapi } from '../request';
import type KeyringService from '@rabby-wallet/service-keyring';
import type { AutoConnectService } from '@/core/services/autoConnect';
import type { DappService } from '@/core/services/dappService';
import type { NotificationService } from '@/core/services/notification';
import type { PreferenceService } from '@/core/services/preference';
import type { Account } from '../services/preference';
import type { ProviderRequest } from './type';
import type { TransactionHistoryService } from '@/core/services/transactionHistory';
import {
  getServiceReady,
  SERVICE_READY_KEYS,
} from '@/core/services/serviceReady';
import { getProviderController } from './provider';

export const resemblesETHAddress = (str: string): boolean => {
  return str.length === 42;
};

const isSignApproval = (type: string) => {
  const SIGN_APPROVALS = ['SignText', 'SignTypedData', 'SignTx'];
  return SIGN_APPROVALS.includes(type);
};

const lockedOrigins = new Set<string>();
const connectOrigins = new Set<string>();

const flow = new PromiseFlow<{
  request: ProviderRequest & {
    session: Exclude<ProviderRequest, void>;
  };
  mapMethod: string;
  approvalRes: any;
}>();
const flowContext = flow
  .use(async (ctx, next) => {
    // check method
    const {
      data: { method },
    } = ctx.request;
    const shouldLogMethod = shouldLogApprovalProbeMethod(method);
    ctx.mapMethod = underline2Camelcase(method);
    const providerController = await getProviderController();

    // // leave here for debug
    // console.debug('[debug] flowContext:: before check method');

    if (Reflect.getMetadata('PRIVATE', providerController, ctx.mapMethod)) {
      if (shouldLogMethod) {
        recordApprovalProbe(
          'RPC_FLOW_PRIVATE_METHOD_REJECTED',
          {
            method,
            mapMethod: ctx.mapMethod,
          },
          { level: 'warn' },
        );
      }
      // Reject when dapp try to call private controller function
      throw ethErrors.rpc.methodNotFound({
        message: `method [${method}] doesn't has corresponding handler`,
        data: ctx.request.data,
      });
    }
    if (!providerController[ctx.mapMethod]) {
      // TODO: make rpc whitelist
      if (method.startsWith('eth_') || method === 'net_version') {
        if (shouldLogMethod) {
          recordApprovalProbe('RPC_FLOW_FALLBACK_TO_ETH_RPC', {
            method,
            mapMethod: ctx.mapMethod,
          });
        }
        return providerController.ethRpc(ctx.request as any);
      }

      if (shouldLogMethod) {
        recordApprovalProbe(
          'RPC_FLOW_HANDLER_NOT_FOUND',
          {
            method,
            mapMethod: ctx.mapMethod,
          },
          { level: 'warn' },
        );
      }
      throw ethErrors.rpc.methodNotFound({
        message: `method [${method}] doesn't has corresponding handler`,
        data: ctx.request.data,
      });
    }

    return next();
  })
  .use(async (ctx, next) => {
    const {
      mapMethod,
      request: {
        data: { method },
        session: { origin },
      },
    } = ctx;
    const shouldLogMethod = shouldLogApprovalProbeMethod(method);
    const providerController = await getProviderController();

    // // leave here for debug
    // console.debug('[debug] flowContext:: before check lock');

    if (!Reflect.getMetadata('SAFE', providerController, mapMethod)) {
      const [keyringService, notificationService] = await Promise.all([
        getServiceReady<KeyringService>(SERVICE_READY_KEYS.keyringService),
        getServiceReady<NotificationService>(
          SERVICE_READY_KEYS.notificationService,
        ),
      ]);
      // check lock
      const isUnlock = keyringService.memStore.getState().isUnlocked;

      if (!isUnlock) {
        if (lockedOrigins.has(origin)) {
          if (shouldLogMethod) {
            recordApprovalProbe(
              'RPC_FLOW_LOCK_ALREADY_PENDING',
              {
                method,
                origin,
              },
              { level: 'warn' },
            );
          }
          throw ethErrors.rpc.resourceNotFound(
            'Already processing unlock. Please wait.',
          );
        }
        ctx.request.requestedApproval = true;
        lockedOrigins.add(origin);
        try {
          if (shouldLogMethod) {
            recordApprovalProbe('RPC_FLOW_LOCK_APPROVAL_REQUEST', {
              method,
              origin,
            });
          }
          await notificationService.requestApproval(
            { lock: true },
            { height: 628 },
          );
          lockedOrigins.delete(origin);
        } catch (e) {
          lockedOrigins.delete(origin);
          if (shouldLogMethod) {
            recordApprovalProbe(
              'RPC_FLOW_LOCK_APPROVAL_ERROR',
              {
                method,
                origin,
                error: getApprovalProbeErrorMessage(e),
              },
              { level: 'warn' },
            );
          }
          throw e;
        }
      }
    }
    // // leave here for debug
    // console.debug('[debug] flowContext:: after check lock');

    return next();
  })
  .use(async (ctx, next) => {
    // check connect
    const {
      request: {
        data: { method },
        session: { origin, name, icon, $mobileCtx },
      },
      mapMethod,
    } = ctx;

    const { isFromMobileInnerDapp } = $mobileCtx || {};
    const shouldLogMethod = shouldLogApprovalProbeMethod(method);
    const providerController = await getProviderController();
    // // leave here for debug
    // console.debug('[debug] flowContext:: before check connect');
    if (!Reflect.getMetadata('SAFE', providerController, mapMethod)) {
      const [
        autoConnectService,
        dappService,
        notificationService,
        preferenceService,
        transactionHistoryService,
      ] = await Promise.all([
        getServiceReady<AutoConnectService>(
          SERVICE_READY_KEYS.autoConnectService,
        ),
        getServiceReady<DappService>(SERVICE_READY_KEYS.dappService),
        getServiceReady<NotificationService>(
          SERVICE_READY_KEYS.notificationService,
        ),
        getServiceReady<PreferenceService>(
          SERVICE_READY_KEYS.preferenceService,
        ),
        getServiceReady<TransactionHistoryService>(
          SERVICE_READY_KEYS.transactionHistoryService,
        ),
      ]);
      if (!dappService.hasPermission(origin)) {
        if (shouldLogMethod) {
          recordApprovalProbe('RPC_FLOW_CONNECT_REQUIRED', {
            method,
            origin,
            isFromMobileInnerDapp: !!isFromMobileInnerDapp,
          });
        }
        if (connectOrigins.has(origin)) {
          if (shouldLogMethod) {
            recordApprovalProbe(
              'RPC_FLOW_CONNECT_ALREADY_PENDING',
              {
                method,
                origin,
              },
              { level: 'warn' },
            );
          }
          throw ethErrors.rpc.resourceNotFound(
            'Already processing connect. Please wait.',
          );
        }
        ctx.request.requestedApproval = true;
        connectOrigins.add(origin);

        try {
          let defaultChain: CHAINS_ENUM | null = null;
          let defaultAccount: Account | undefined = undefined;
          const autoConnectInfo = await autoConnectService.autoConnect(origin);
          if (autoConnectInfo) {
            defaultAccount = autoConnectInfo.defaultAccount;
            defaultChain = autoConnectInfo.defaultChain || CHAINS_ENUM.ETH;
            if (shouldLogMethod) {
              recordApprovalProbe('RPC_FLOW_CONNECT_AUTO_CONNECT', {
                method,
                origin,
                defaultChain,
                hasDefaultAccount: !!defaultAccount,
              });
            }
          } else if (
            isFromMobileInnerDapp &&
            shouldAutoConnect(origin, ctx.request.data.method)
          ) {
            const site = dappService.getDapp(origin);
            const { accounts } = await getAccountList();
            defaultAccount = selectDappAccount({
              dappInfo: site,
              accounts,
              recentTransactions: transactionHistoryService.store.transactions,
              fallbackAccount: preferenceService.getFallbackAccount(),
            })!;
            defaultChain =
              site?.chainId && findChain({ enum: site.chainId })
                ? site.chainId
                : null;

            if (defaultAccount && !defaultChain) {
              const recommendChains = await openapi.getRecommendChains(
                defaultAccount.address,
                origin,
              );
              let targetChain: Chain | undefined;
              if (recommendChains) {
                for (let i = 0; i < recommendChains.length; i++) {
                  targetChain =
                    findChain({
                      serverId: recommendChains[i]?.id,
                    }) || undefined;
                  if (targetChain) {
                    break;
                  }
                }
              }

              defaultChain = targetChain ? targetChain.enum : CHAINS_ENUM.ETH;
            }
            if (shouldLogMethod) {
              recordApprovalProbe('RPC_FLOW_CONNECT_AUTO_SELECT', {
                method,
                origin,
                defaultChain,
                hasDefaultAccount: !!defaultAccount,
              });
            }
          } else {
            if (shouldLogMethod) {
              recordApprovalProbe('RPC_FLOW_CONNECT_REQUEST_APPROVAL', {
                method,
                origin,
              });
            }
            const res = await notificationService.requestApproval(
              {
                params: { origin, name, icon, $mobileCtx },
                account: ctx.request.account,
                approvalComponent: 'Connect',
              },
              { height: 800 },
            );
            defaultChain = res.defaultChain;
            defaultAccount = res.defaultAccount;
            if (shouldLogMethod) {
              recordApprovalProbe('RPC_FLOW_CONNECT_APPROVAL_RESOLVED', {
                method,
                origin,
                defaultChain,
                hasDefaultAccount: !!defaultAccount,
              });
            }
          }
          connectOrigins.delete(origin);
          await apisDapp.connect({
            origin,
            chainId: defaultChain || CHAINS_ENUM.ETH,
            currentAccount:
              defaultAccount || preferenceService.getFallbackAccount(),
            session: {
              name,
              icon,
              origin,
              $mobileCtx,
            },
          });
          ctx.request.account =
            defaultAccount || preferenceService.getFallbackAccount()!;
          if (shouldLogMethod) {
            recordApprovalProbe('RPC_FLOW_CONNECT_COMPLETED', {
              method,
              origin,
              finalChain: defaultChain || CHAINS_ENUM.ETH,
              hasAccount: !!ctx.request.account,
            });
          }
        } catch (e) {
          connectOrigins.delete(origin);
          if (shouldLogMethod) {
            recordApprovalProbe(
              'RPC_FLOW_CONNECT_ERROR',
              {
                method,
                origin,
                error: getApprovalProbeErrorMessage(e),
              },
              { level: 'warn' },
            );
          }
          throw e;
        }
      }
    }
    // // leave here for debug
    // console.debug('[debug] flowContext:: after check connect');
    return next();
  })
  .use(async (ctx, next) => {
    // check need approval
    const {
      request: {
        data: { params, method },
        session: { origin, name, icon, $mobileCtx: _$mobileCtx },
      },
      mapMethod,
    } = ctx;
    const shouldLogMethod = shouldLogApprovalProbeMethod(method);
    const $mobileCtx = _$mobileCtx || params?.$mobileCtx;
    const isFromMobileInnerDapp = $mobileCtx?.isFromMobileInnerDapp;
    // // leave here for debug
    // console.debug('[debug] flowContext:: before check need approval');
    const providerController = await getProviderController();
    const [dappService, notificationService] = await Promise.all([
      getServiceReady<DappService>(SERVICE_READY_KEYS.dappService),
      getServiceReady<NotificationService>(
        SERVICE_READY_KEYS.notificationService,
      ),
    ]);
    const [approvalType, condition, options = {}] =
      Reflect.getMetadata('APPROVAL', providerController, mapMethod) || [];

    let windowHeight = 800;
    // TODO: remove this
    if ('height' in options) {
      windowHeight = options.height;
    } else {
      const minHeight = 500;
      if (windowHeight < minHeight) {
        windowHeight = minHeight;
      }
    }
    if (approvalType === 'SignText') {
      let from, message;
      const [first, second] = params;
      // Compatible with wrong params order
      // ref: https://github.com/MetaMask/eth-json-rpc-middleware/blob/53c7361944c380e011f5f4ee1e184db746e26d73/src/wallet.ts#L284
      if (resemblesETHAddress(first) && !resemblesETHAddress(second)) {
        from = first;
        message = second;
      } else {
        from = second;
        message = first;
      }
      const hexReg = /^[0-9A-Fa-f]+$/gu;
      const stripped = stripHexPrefix(message);
      if (stripped.match(hexReg)) {
        message = addHexPrefix(stripped);
      }
      ctx.request.data.params[0] = message;
      ctx.request.data.params[1] = from;
    }
    if (approvalType && (!condition || !(await condition(ctx.request)))) {
      ctx.request.requestedApproval = true;
      if (shouldLogMethod) {
        recordApprovalProbe('RPC_FLOW_APPROVAL_REQUIRED', {
          method,
          origin,
          approvalType,
        });
      }
      if (approvalType === 'SignTx' && !('chainId' in params[0])) {
        const site = dappService.getConnectedDapp(origin);
        if (site) {
          const chain = findChain({
            enum: site.chainId,
          });
          if (chain) {
            params[0].chainId = chain.id;
          }
        }
      }
      if (
        !isFromMobileInnerDapp ||
        !(await shouldAutoPersonalSign({
          origin,
          method: ctx.request.data.method,
          account: ctx.request.account,
          msgParams: ctx.request.data.params,
        }))
      ) {
        if (shouldLogMethod) {
          recordApprovalProbe('RPC_FLOW_REQUEST_APPROVAL', {
            method,
            origin,
            approvalType,
            windowHeight,
          });
        }
        ctx.approvalRes = await notificationService.requestApproval(
          {
            approvalComponent: approvalType,
            params: {
              $ctx: ctx?.request?.data?.$ctx,
              $mobileCtx,
              method,
              data: ctx.request.data.params,
              session: { origin, name, icon, $mobileCtx },
            },
            account: ctx.request.account,
            origin,
          },
          { height: windowHeight },
        );
        if (shouldLogMethod) {
          recordApprovalProbe('RPC_FLOW_REQUEST_APPROVAL_RESOLVED', {
            method,
            origin,
            approvalType,
            hasApprovalRes: !!ctx.approvalRes,
            hasUiRequestComponent: !!ctx.approvalRes?.uiRequestComponent,
          });
        }
      } else if (shouldLogMethod) {
        recordApprovalProbe('RPC_FLOW_APPROVAL_SKIPPED_AUTO_PERSONAL_SIGN', {
          method,
          origin,
          approvalType,
        });
      }

      if (isSignApproval(approvalType)) {
        const dapp = dappService.getDapp(origin);
        if (dapp) {
          dappService.updateDapp({
            ...dapp,
            isSigned: true,
          });
        }
      }
    }

    return next();
  })
  .use(async ctx => {
    const providerController = await getProviderController();
    const [dappService, notificationService] = await Promise.all([
      getServiceReady<DappService>(SERVICE_READY_KEYS.dappService),
      getServiceReady<NotificationService>(
        SERVICE_READY_KEYS.notificationService,
      ),
    ]);
    const { approvalRes, mapMethod, request } = ctx;
    const method = request.data.method;
    const shouldLogMethod = shouldLogApprovalProbeMethod(method);
    // process request
    const [approvalType] =
      Reflect.getMetadata('APPROVAL', providerController, mapMethod) || [];
    // // leave here for debug
    // console.debug('[debug] flowContext:: before process request');
    const { uiRequestComponent, ...rest } = approvalRes || {};
    const {
      session: { origin, $mobileCtx },
    } = request;

    const isFromMobileInnerDapp = $mobileCtx?.isFromMobileInnerDapp;

    const isAutoPersonalSign =
      isFromMobileInnerDapp &&
      (await shouldAutoPersonalSign({
        origin,
        method: ctx.request.data.method,
        account: ctx.request.account,
        msgParams: ctx.request.data.params,
      }));

    const createRequestDeferFn =
      (originApprovalRes: typeof approvalRes) =>
      async (isRetry = false) =>
        new Promise(async (resolve, reject) => {
          let waitSignComponentPromise = Promise.resolve();
          if (
            !isAutoPersonalSign &&
            isSignApproval(approvalType) &&
            uiRequestComponent
          ) {
            waitSignComponentPromise = waitSignComponentAmounted();
          }

          if (originApprovalRes?.isGnosis) return resolve(undefined);

          return waitSignComponentPromise.then(() => {
            let _approvalRes = originApprovalRes;

            if (isRetry && mapMethod === 'ethSendTransaction') {
              _approvalRes = { ...originApprovalRes };
              const retryType = getRetryTxType();
              switch (retryType) {
                case 'nonce':
                  const recommendNonce = getRetryTxRecommendNonce();
                  _approvalRes.nonce = intToHex(
                    hexToNumber(recommendNonce as '0x${string}'),
                  );
                  break;
                case 'gasPrice':
                  if (_approvalRes.gasPrice) {
                    _approvalRes.gasPrice = `0x${new BigNumber(
                      new BigNumber(_approvalRes.gasPrice, 16)
                        .times(1.3)
                        .toFixed(0),
                    ).toString(16)}`;
                  }
                  if (_approvalRes.maxFeePerGas) {
                    _approvalRes.maxFeePerGas = `0x${new BigNumber(
                      new BigNumber(_approvalRes.maxFeePerGas, 16)
                        .times(1.3)
                        .toFixed(0),
                    ).toString(16)}`;
                  }
                  break;
                default:
                  break;
              }
              if (retryType) {
                notificationService.setCurrentRequestDeferFn(
                  createRequestDeferFn(_approvalRes),
                );
              }
            }

            return Promise.resolve(
              providerController[mapMethod]({
                ...request,
                approvalRes: _approvalRes,
              }),
            )
              .then(result => {
                if (isSignApproval(approvalType)) {
                  eventBus.emit(EVENTS.SIGN_FINISHED, {
                    success: true,
                    data: result,
                  });
                }
                return result;
              })
              .then(resolve)
              .catch((e: any) => {
                const payload = {
                  method: EVENTS.SIGN_FINISHED,
                  params: {
                    success: false,
                    errorMsg: e?.message || JSON.stringify(e),
                  },
                };
                if (e.method) {
                  payload.method = e.method;
                  payload.params = e.message;
                }

                Sentry.captureException(e);
                if (isSignApproval(approvalType)) {
                  eventBus.emit(payload.method, payload.params);
                } else if (__DEV__) {
                  console.error(e);
                }
                reject(e);
              });
          });
        });
    const requestDeferFn = createRequestDeferFn(approvalRes);

    notificationService.setCurrentRequestDeferFn(requestDeferFn);
    if (shouldLogMethod) {
      recordApprovalProbe('RPC_FLOW_REQUEST_DEFER_START', {
        method,
        origin,
        approvalType,
        hasUiRequestComponent: !!uiRequestComponent,
        isAutoPersonalSign,
      });
    }
    const requestDefer = requestDeferFn();
    async function requestApprovalLoop({
      uiRequestComponent,
      $account,
      ...rest
    }) {
      ctx.request.requestedApproval = true;

      try {
        const res = await notificationService.requestApproval({
          approvalComponent: uiRequestComponent,
          params: {
            ...rest,
            $mobileCtx: rest.$mobileCtx || $mobileCtx,
          },
          account: $account,
          origin,
          approvalType,
          isUnshift: true,
        });
        if (res?.uiRequestComponent) {
          return await requestApprovalLoop(res);
        } else {
          return res;
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
    if (!isAutoPersonalSign && uiRequestComponent) {
      ctx.request.requestedApproval = true;
      const result = await requestApprovalLoop({ uiRequestComponent, ...rest });
      await reportStatsData();
      if (rest?.safeMessage) {
        const safeMessage: {
          safeAddress: string;
          message: string | Record<string, any>;
          chainId: number;
          safeMessageHash: string;
        } = rest.safeMessage;
        if (ctx.request.requestedApproval) {
          flow.requestedApproval = false;
          // only unlock notification if current flow is an approval flow
          notificationService.unLock();
        }
        return gnosisController.watchMessage({
          address: safeMessage.safeAddress,
          chainId: safeMessage.chainId,
          safeMessageHash: safeMessage.safeMessageHash,
        });
      } else {
        return result;
      }
    }

    // // leave here for debug
    // console.debug('[debug] flowContext:: after process request', await requestDefer);

    return requestDefer.then(
      result => {
        if (shouldLogMethod) {
          recordApprovalProbe('RPC_FLOW_REQUEST_DEFER_RESOLVED', {
            method,
            origin,
            approvalType,
          });
        }

        return result;
      },
      error => {
        if (shouldLogMethod) {
          recordApprovalProbe(
            'RPC_FLOW_REQUEST_DEFER_ERROR',
            {
              method,
              origin,
              approvalType,
              error: getApprovalProbeErrorMessage(error),
            },
            { level: 'warn' },
          );
        }

        throw error;
      },
    );
  })
  .callback();

async function reportStatsData() {
  const notificationService = await getServiceReady<NotificationService>(
    SERVICE_READY_KEYS.notificationService,
  );
  const statsData = notificationService.getStatsData();
  if (!statsData || statsData.reported) return;
  if (statsData?.signed) {
    const sData: any = {
      type: statsData?.type,
      chainId: statsData?.chainId,
      category: statsData?.category,
      success: statsData?.signedSuccess,
      preExecSuccess: statsData?.preExecSuccess,
      createdBy: statsData?.createdBy,
      source: statsData?.source,
      trigger: statsData?.trigger,
      networkType: statsData?.networkType,
    };
    if (statsData.signMethod) {
      sData.signMethod = statsData.signMethod;
    }
    stats.report('signedTransaction', sData);
  }
  if (statsData?.submit) {
    stats.report('submitTransaction', {
      type: statsData?.type,
      chainId: statsData?.chainId,
      category: statsData?.category,
      success: statsData?.submitSuccess,
      preExecSuccess: statsData?.preExecSuccess,
      createdBy: statsData?.createdBy,
      source: statsData?.source,
      trigger: statsData?.trigger,
      networkType: statsData?.networkType || '',
    });
  }
  statsData.reported = true;
  notificationService.setStatsData(statsData);
}

export default async (request: ProviderRequest) => {
  const ctx: any = {
    request: { ...request, requestedApproval: false },
  };
  try {
    const origin = request.origin || request.session.origin;
    const dappService = await getServiceReady<DappService>(
      SERVICE_READY_KEYS.dappService,
    );
    const dapp = dappService.getDapp(origin);
    if (dapp && !dapp.isDapp) {
      dappService.updateDapp({
        ...dapp,
        isDapp: true,
      });
    }
  } catch (e) {}
  const notificationService = await getServiceReady<NotificationService>(
    SERVICE_READY_KEYS.notificationService,
  );
  notificationService.setStatsData();
  return flowContext(ctx).finally(async () => {
    await reportStatsData();

    if (ctx.request.requestedApproval) {
      flow.requestedApproval = false;
      // only unlock notification if current flow is an approval flow
      notificationService.unLock();
    }
  });
};
