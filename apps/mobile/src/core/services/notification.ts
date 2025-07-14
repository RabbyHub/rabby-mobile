import Events from 'events';
import { ethErrors } from 'eth-rpc-errors';
import { v4 as uuidv4 } from 'uuid';
import { EthereumProviderError } from 'eth-rpc-errors/dist/classes';
import * as Sentry from '@sentry/react-native';

// import stats from '@/stats';
import BigNumber from 'bignumber.js';

import { stats } from '@/utils/stats';
import { KEYRING_CATEGORY_MAP } from '@rabby-wallet/keyring-utils';
import { apisAppWin } from './appWin';
import type { EVENT_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { findChain } from '@/utils/chain';
import { Account } from './preference';

export interface Approval {
  id: string;
  taskId: number | null;
  signingTxId?: string;
  data: {
    params?: any;
    $mobileCtx?: any;
    account: Account;
    origin?: string;
    approvalComponent: string;
    requestDefer?: Promise<any>;
    approvalType?: string;
  };
  winProps: any;
  resolve?(params?: any): void;
  reject?(err: EthereumProviderError<any>): void;
}

const QUEUE_APPROVAL_COMPONENTS_WHITELIST = [
  'SignTx',
  'SignText',
  'SignTypedData',
  'LedgerHardwareWaiting',
  'OneKeyHardwareWaiting',
  'QRHardWareWaiting',
  'WatchAddressWaiting',
  'CommonWaiting',
  'PrivatekeyWaiting',
  'CoinbaseWaiting',
];

export type StatsData = {
  signed: boolean;
  signedSuccess: boolean;
  submit: boolean;
  submitSuccess: boolean;
  type: string;
  chainId: string;
  category: string;
  preExecSuccess: boolean;
  createdBy: string;
  source: any;
  trigger: any;
  reported: boolean;
  signMethod?: string;
  networkType?: string;
};

type RequestApprovalParamBase = {
  approvalComponent: string;
  params: any;
  origin: string;
  approvalType: string;
  isUnshift?: boolean;
  account?: Account | undefined;
};
type RequestApprovaParam =
  | ({
      lock?: undefined | false;
    } & RequestApprovalParamBase)
  | ({
      lock?: true;
    } & Partial<RequestApprovalParamBase>);

// something need user approval in window
// should only open one window, unfocus will close the current notification
export class NotificationService extends Events {
  currentApproval: Approval | null = null;
  currentMiniApproval: { signingTxId?: string } | null = null;
  dappManager = new Map<
    string,
    {
      lastRejectTimestamp: number;
      lastRejectCount: number;
      blockedTimestamp: number;
      isBlocked: boolean;
    }
  >();
  _approvals: Approval[] = [];
  notifyWindowId: null | string = null;
  isLocked = false;
  currentRequestDeferFn?: (isRetry?: boolean) => void;
  statsData: StatsData | undefined;
  preferenceService: import('./preference').PreferenceService;
  transactionHistoryService: import('./transactionHistory').TransactionHistoryService;

  get approvals() {
    return this._approvals;
  }

  set approvals(val: Approval[]) {
    this._approvals = val;
  }

  constructor({ preferenceService, transactionHistoryService }) {
    super();

    this.preferenceService = preferenceService;
    this.transactionHistoryService = transactionHistoryService;
    apisAppWin.globalBottomSheetModalAddListener(
      'DISMISS' as EVENT_NAMES.DISMISS,
      windId => {
        if (windId === this.notifyWindowId) {
          this.notifyWindowId = null;
          this.rejectAllApprovals();
        }
      },
    );

    // TODO: 可能不需要
    // winMgr.event.on('windowFocusChange', (winId: number) => {
    //   if (this.notifiWindowId !== null && winId !== this.notifiWindowId) {
    //     if (
    //       this.currentApproval &&
    //       !QUEUE_APPROVAL_COMPONENTS_WHITELIST.includes(
    //         this.currentApproval.data.approvalComponent,
    //       )
    //     ) {
    //       this.rejectApproval();
    //     }
    //   }
    // });
  }

  activeFirstApproval = () => {
    try {
      // TODO 不需要
      // const windows = await browser.windows.getAll();
      // const existWindow = windows.find(
      //   window => window.id === this.notifiWindowId,
      // );
      // if (this.notifiWindowId !== null && !!existWindow) {
      //   browser.windows.update(this.notifiWindowId, {
      //     focused: true,
      //   });
      //   return;
      // }

      if (this.approvals.length < 0) return;

      const approval = this.approvals[0];
      this.currentApproval = approval;
      this.openNotification(approval.winProps, true);
    } catch (e) {
      Sentry.captureException(
        'activeFirstApproval failed: ' + JSON.stringify(e),
      );
      console.log('activeFirstApproval failed: ' + JSON.stringify(e));
      this.clear();
    }
  };

  deleteApproval = (approval: Approval | null) => {
    if (approval && this.approvals.length > 1) {
      this.approvals = this.approvals.filter(item => approval.id !== item.id);
    } else {
      this.currentApproval = null;
      this.approvals = [];
    }
  };

  getApproval = () => this.currentApproval;

  resolveApproval = async (
    data?: any,
    forceReject = false,
    approvalId?: string,
  ) => {
    if (approvalId && approvalId !== this.currentApproval?.id) return;
    if (forceReject) {
      this.currentApproval?.reject &&
        this.currentApproval?.reject(
          ethErrors.provider.userRejectedRequest('User Cancel'),
        );
    } else {
      this.currentApproval?.resolve && this.currentApproval?.resolve(data);
    }

    const approval = this.currentApproval;

    this.clearLastRejectDapp();
    this.deleteApproval(approval);

    if (this.approvals.length > 0) {
      this.currentApproval = this.approvals[0];
    } else {
      this.currentApproval = null;
    }

    this.emit('resolve', data);
  };

  rejectApproval = async (err?: string, stay = false, isInternal = false) => {
    this.addLastRejectDapp();
    const approval = this.currentApproval;
    if (this.approvals.length <= 1) {
      await this.clear(stay);
    }

    if (isInternal) {
      approval?.reject && approval?.reject(ethErrors.rpc.internal(err));
    } else {
      approval?.reject &&
        approval?.reject(ethErrors.provider.userRejectedRequest<any>(err));
    }

    if (approval?.signingTxId) {
      this.transactionHistoryService.removeSigningTx(approval.signingTxId);
    }

    if (approval && this.approvals.length > 1) {
      this.deleteApproval(approval);
      this.currentApproval = this.approvals[0];
    } else {
      await this.clear(stay);
    }
    this.emit('reject', err);
  };

  requestApproval = async (
    inputData: RequestApprovaParam,
    winProps?: any,
  ): Promise<any> => {
    const origin = this.getOrigin(inputData);
    if (origin) {
      const dapp = this.dappManager.get(origin);
      // is blocked and less 1 min
      if (
        dapp?.isBlocked &&
        Date.now() - dapp.blockedTimestamp < 60 * 1000 * 1
      ) {
        throw ethErrors.provider.userRejectedRequest(
          'User rejected the request.',
        );
      }
    }
    const data = inputData as RequestApprovalParamBase;
    const currentAccount =
      data.account || this.preferenceService.getFallbackAccount();
    const reportExplain = (signingTxId?: string) => {
      const signingTx = signingTxId
        ? this.transactionHistoryService.getSigningTx(signingTxId)
        : null;
      const explain = signingTx?.explain;
      const chain = findChain({
        id: signingTx?.rawTx.chainId,
      });

      if ((explain || chain?.isTestnet) && currentAccount) {
        stats.report('preExecTransaction', {
          type: currentAccount.brandName,
          category: KEYRING_CATEGORY_MAP[currentAccount.type],
          chainId: chain?.serverId || '',
          success: explain
            ? explain.calcSuccess && explain.pre_exec.success
            : true,
          createdBy: data?.params.$ctx?.ga ? 'rabby' : 'dapp',
          source: data?.params.$ctx?.ga?.source || '',
          trigger: data?.params.$ctx?.ga?.trigger || '',
        });
      }
    };
    return new Promise(async (resolve, reject) => {
      const uuid = uuidv4();
      let signingTxId;
      if (data.approvalComponent === 'SignTx') {
        signingTxId = this.transactionHistoryService.addSigningTx(
          data.params.data[0],
        );
      } else {
        signingTxId = data?.params?.signingTxId;
      }

      const approval: Approval = {
        taskId: uuid as any,
        id: uuid,
        signingTxId,
        // todo fix ts
        data: data as any,
        winProps,
        resolve(data) {
          if (this.data.approvalComponent === 'SignTx') {
            reportExplain(this.signingTxId);
          }
          resolve(data);
        },
        reject(data) {
          if (this.data.approvalComponent === 'SignTx') {
            reportExplain(this.signingTxId);
          }
          reject(data);
        },
      };

      if (
        !QUEUE_APPROVAL_COMPONENTS_WHITELIST.includes(data.approvalComponent)
      ) {
        if (this.currentApproval) {
          throw ethErrors.provider.userRejectedRequest(
            'please request after current approval resolve',
          );
        }
      } else {
        if (
          this.currentApproval &&
          !QUEUE_APPROVAL_COMPONENTS_WHITELIST.includes(
            this.currentApproval.data.approvalComponent,
          )
        ) {
          throw ethErrors.provider.userRejectedRequest(
            'please request after current approval resolve',
          );
        }
      }

      if (data.isUnshift) {
        this.approvals = [approval, ...this.approvals];
        this.currentApproval = approval;
      } else {
        this.approvals = [...this.approvals, approval];
        if (!this.currentApproval) {
          this.currentApproval = approval;
        }
      }

      if (this.notifyWindowId !== null) {
        apisAppWin.presentGlobalBottomSheetModal(this.notifyWindowId);
      } else {
        await this.openNotification(approval.winProps);
      }
    });
  };

  clear = async (stay = false) => {
    this.approvals = [];
    this.currentApproval = null;
    if (this.notifyWindowId !== null && !stay) {
      try {
        // some times the window is already closed, we need set a maxtime to wait
        await apisAppWin.removeGlobalBottomSheetModal(this.notifyWindowId, {
          waitMaxtime: 300,
        });
      } catch (e) {
        // ignore error
      }
      this.notifyWindowId = null;
    }
  };

  rejectAllApprovals = () => {
    this.addLastRejectDapp();
    this.approvals.forEach(approval => {
      approval.reject &&
        approval.reject(
          // new EthereumProviderError(4001, 'User rejected the request.'),
          ethErrors.provider.userRejectedRequest('User rejected the request.'),
        );
    });
    this.approvals = [];
    this.currentApproval = null;
    this.transactionHistoryService.removeAllSigningTx();
  };

  unLock = () => {
    this.isLocked = false;
  };

  lock = () => {
    this.isLocked = true;
  };

  openNotification = async (winProps: any, ignoreLock = false) => {
    // Only use ignoreLock flag when approval exist but no notification window exist
    if (!ignoreLock) {
      if (this.isLocked) return;
      this.lock();
    }
    if (this.notifyWindowId !== null) {
      await apisAppWin.removeGlobalBottomSheetModal(this.notifyWindowId);
      this.notifyWindowId = null;
    }
    this.notifyWindowId =
      apisAppWin.createGlobalBottomSheetModal(winProps) ?? null;
  };

  setCurrentRequestDeferFn = (fn: (isRetry?: boolean) => void) => {
    this.currentRequestDeferFn = fn;
  };

  callCurrentRequestDeferFn = (isRetry?: boolean) => {
    return this.currentRequestDeferFn?.(isRetry);
  };

  setStatsData = (data?: StatsData) => {
    this.statsData = data;
  };

  getStatsData = () => {
    return this.statsData;
  };

  private addLastRejectDapp() {
    // not Rabby dapp
    if (this.currentApproval?.data?.params?.$ctx) return;
    const origin = this.getOrigin();
    if (!origin) {
      return;
    }
    const dapp = this.dappManager.get(origin);
    // same origin and less 1 min
    if (dapp && Date.now() - dapp.lastRejectTimestamp < 60 * 1000) {
      dapp.lastRejectCount = dapp.lastRejectCount + 1;
      dapp.lastRejectTimestamp = Date.now();
    } else {
      this.dappManager.set(origin, {
        lastRejectTimestamp: Date.now(),
        lastRejectCount: 1,
        blockedTimestamp: 0,
        isBlocked: false,
      });
    }
  }

  private clearLastRejectDapp() {
    const origin = this.getOrigin();
    if (!origin) {
      return;
    }
    this.dappManager.delete(origin);
  }

  checkNeedDisplayBlockedRequestApproval = () => {
    const origin = this.getOrigin();
    if (!origin) {
      return false;
    }
    const dapp = this.dappManager.get(origin);
    if (!dapp) return false;
    // less 1 min and reject count more than 2 times
    if (
      Date.now() - dapp.lastRejectTimestamp < 60 * 1000 &&
      dapp.lastRejectCount >= 2
    ) {
      return true;
    }
    return false;
  };
  checkNeedDisplayCancelAllApproval = () => {
    return this.approvals.length > 1;
  };

  blockedDapp = () => {
    const origin = this.getOrigin();
    if (!origin) {
      return;
    }
    const dapp = this.dappManager.get(origin);
    if (!dapp) return;

    dapp.isBlocked = true;
    dapp.blockedTimestamp = Date.now();
  };

  private getOrigin(
    data: RequestApprovaParam | undefined = this.currentApproval?.data,
  ): string {
    return data?.params?.origin || data?.origin;
  }
}
