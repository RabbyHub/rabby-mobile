import { ethErrors } from 'eth-rpc-errors';
// import {
//   keyringService,
//   notificationService,
//   permissionService,
// } from 'background/service';
import {
  dappService,
  keyringService,
  notificationService,
  preferenceService,
} from '../services';
import PromiseFlow from '@/utils/promiseFlow';
import providerController from './provider';
// import eventBus from '@/eventBus';
import { ProviderRequest } from './type';
import * as Sentry from '@sentry/react-native';
// import stats from '@/stats';
import { addHexPrefix, stripHexPrefix } from 'ethereumjs-util';
import { eventBus, EVENTS } from '@/utils/events';
import { CHAINS_ENUM } from '@/constant/chains';
import * as apisDapp from '../apis/dapp';
import { stats } from '@/utils/stats';
import { waitSignComponentAmounted } from '../utils/signEvent';
import { findChain } from '@/utils/chain';
import { gnosisController } from './gnosisController';
import { underline2Camelcase } from '../utils/common';
import { reject } from 'lodash';
import { getRetryTxRecommendNonce, getRetryTxType } from '@/utils/errorTxRetry';
import { hexToNumber, isHex } from 'viem';
import { intToHex } from '@/utils/number';
import BigNumber from 'bignumber.js';

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
    ctx.mapMethod = underline2Camelcase(method);

    // // leave here for debug
    // console.debug('[debug] flowContext:: before check method');

    if (Reflect.getMetadata('PRIVATE', providerController, ctx.mapMethod)) {
      // Reject when dapp try to call private controller function
      throw ethErrors.rpc.methodNotFound({
        message: `method [${method}] doesn't has corresponding handler`,
        data: ctx.request.data,
      });
    }
    if (!providerController[ctx.mapMethod]) {
      // TODO: make rpc whitelist
      if (method.startsWith('eth_') || method === 'net_version') {
        return providerController.ethRpc(ctx.request as any);
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
        session: { origin },
      },
    } = ctx;
    // // leave here for debug
    // console.debug('[debug] flowContext:: before check lock');

    if (!Reflect.getMetadata('SAFE', providerController, mapMethod)) {
      // check lock
      const isUnlock = keyringService.memStore.getState().isUnlocked;

      if (!isUnlock) {
        if (lockedOrigins.has(origin)) {
          throw ethErrors.rpc.resourceNotFound(
            'Already processing unlock. Please wait.',
          );
        }
        ctx.request.requestedApproval = true;
        lockedOrigins.add(origin);
        try {
          await notificationService.requestApproval(
            { lock: true },
            { height: 628 },
          );
          lockedOrigins.delete(origin);
        } catch (e) {
          lockedOrigins.delete(origin);
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
        session: { origin, name, icon, $mobileCtx },
      },
      mapMethod,
    } = ctx;
    // // leave here for debug
    // console.debug('[debug] flowContext:: before check connect');
    if (!Reflect.getMetadata('SAFE', providerController, mapMethod)) {
      if (!dappService.hasPermission(origin)) {
        if (connectOrigins.has(origin)) {
          throw ethErrors.rpc.resourceNotFound(
            'Already processing connect. Please wait.',
          );
        }
        ctx.request.requestedApproval = true;
        connectOrigins.add(origin);
        try {
          const { defaultChain, defaultAccount } =
            await notificationService.requestApproval(
              {
                params: { origin, name, icon, $mobileCtx },
                account: ctx.request.account,
                approvalComponent: 'Connect',
              },
              { height: 800 },
            );
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
            defaultAccount || preferenceService.getFallbackAccount();
        } catch (e) {
          connectOrigins.delete(origin);
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
    const $mobileCtx = _$mobileCtx || params.$mobileCtx;
    // // leave here for debug
    // console.debug('[debug] flowContext:: before check need approval');
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
    if (approvalType && (!condition || !condition(ctx.request))) {
      ctx.request.requestedApproval = true;
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
    const { approvalRes, mapMethod, request } = ctx;
    // process request
    const [approvalType] =
      Reflect.getMetadata('APPROVAL', providerController, mapMethod) || [];
    // // leave here for debug
    // console.debug('[debug] flowContext:: before process request');
    const { uiRequestComponent, ...rest } = approvalRes || {};
    const {
      session: { origin, $mobileCtx },
    } = request;

    const createRequestDeferFn =
      (originApprovalRes: typeof approvalRes) =>
      async (isRetry = false) =>
        new Promise(async resolve => {
          let waitSignComponentPromise = Promise.resolve();
          if (isSignApproval(approvalType) && uiRequestComponent) {
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
                  console.log('current nonce', _approvalRes.nonce);
                  console.log('recommendNonce nonce', recommendNonce);
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
    if (uiRequestComponent) {
      ctx.request.requestedApproval = true;
      const result = await requestApprovalLoop({ uiRequestComponent, ...rest });
      reportStatsData();
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

    return requestDefer;
  })
  .callback();

function reportStatsData() {
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
    const dapp = dappService.getDapp(origin);
    if (dapp && !dapp.isDapp) {
      dappService.updateDapp({
        ...dapp,
        isDapp: true,
      });
    }
  } catch (e) {}
  notificationService.setStatsData();
  return flowContext(ctx).finally(() => {
    reportStatsData();

    if (ctx.request.requestedApproval) {
      flow.requestedApproval = false;
      // only unlock notification if current flow is an approval flow
      notificationService.unLock();
    }
  });
};
