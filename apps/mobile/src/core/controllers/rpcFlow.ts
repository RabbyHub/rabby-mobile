import { ethErrors } from 'eth-rpc-errors';
// import {
//   keyringService,
//   notificationService,
//   permissionService,
// } from 'background/service';
import { dappService, keyringService, notificationService } from '../services';
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

export const underline2Camelcase = (str: string) => {
  return str.replace(/_(.)/g, (m, p1) => p1.toUpperCase());
};

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
        session: { origin, name, icon },
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
          const { defaultChain, signPermission } =
            await notificationService.requestApproval(
              {
                params: { origin, name, icon },
                approvalComponent: 'Connect',
              },
              { height: 800 },
            );
          connectOrigins.delete(origin);
          apisDapp.connect({
            origin,
            chainId: defaultChain || CHAINS_ENUM.ETH,
            session: {
              name,
              icon,
              origin,
            },
          });
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
        session: { origin, name, icon },
      },
      mapMethod,
    } = ctx;
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
            method,
            data: ctx.request.data.params,
            session: { origin, name, icon },
          },
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
      session: { origin },
    } = request;
    const requestDeferFn = async () =>
      new Promise(async resolve => {
        let waitSignComponentPromise = Promise.resolve();
        if (isSignApproval(approvalType) && uiRequestComponent) {
          waitSignComponentPromise = waitSignComponentAmounted();
        }

        if (approvalRes?.isGnosis) return resolve(undefined);

        return waitSignComponentPromise.then(() =>
          Promise.resolve(
            providerController[mapMethod]({
              ...request,
              approvalRes,
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
              Sentry.captureException(e);
              if (isSignApproval(approvalType)) {
                eventBus.emit(EVENTS.SIGN_FINISHED, {
                  success: false,
                  errorMsg: e?.message || JSON.stringify(e),
                });
              } else if (__DEV__) {
                console.error(e);
              }
            }),
        );
      });
    notificationService.setCurrentRequestDeferFn(requestDeferFn);
    const requestDefer = requestDeferFn();
    async function requestApprovalLoop({ uiRequestComponent, ...rest }) {
      ctx.request.requestedApproval = true;
      try {
        const res = await notificationService.requestApproval({
          approvalComponent: uiRequestComponent,
          params: rest,
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
      return result;
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
      createBy: statsData?.createBy,
      source: statsData?.source,
      trigger: statsData?.trigger,
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
      createBy: statsData?.createBy,
      source: statsData?.source,
      trigger: statsData?.trigger,
    });
  }
  statsData.reported = true;
  notificationService.setStatsData(statsData);
}

export default async (request: ProviderRequest) => {
  const ctx: any = { request: { ...request, requestedApproval: false } };
  notificationService.setStatsData();
  return flowContext(ctx).finally(() => {
    reportStatsData();

    if (ctx.request.requestedApproval) {
      flow.requestedApproval = false;
      // only unlock notification if current flow is an approval flow
      notificationService.unLock();
      keyringService.resetResend();
    }
  });
};
