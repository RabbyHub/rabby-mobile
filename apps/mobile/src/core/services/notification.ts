import Events from 'events';
import { ethErrors } from 'eth-rpc-errors';
import { v4 as uuidv4 } from 'uuid';
import { EthereumProviderError } from 'eth-rpc-errors/dist/classes';
import { CHAINS } from '@/constant/chains';
// import stats from '@/stats';
import BigNumber from 'bignumber.js';
import { preferenceService, transactionHistoryService } from './shared';
import {
  createGlobalBottomSheetModal,
  globalBottomSheetModalAddListener,
  presentGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal/utils';

export interface Approval {
  id: string;
  taskId: number | null;
  signingTxId?: string;
  data: {
    params?: any;
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
  createBy: string;
  source: any;
  trigger: any;
  reported: boolean;
  signMethod?: string;
};

// something need user approval in window
// should only open one window, unfocus will close the current notification
export class NotificationService extends Events {
  currentApproval: Approval | null = null;
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
  currentRequestDeferFn?: () => void;
  statsData: StatsData | undefined;

  get approvals() {
    return this._approvals;
  }

  set approvals(val: Approval[]) {
    this._approvals = val;
  }

  constructor() {
    super();

    globalBottomSheetModalAddListener('DISMISS', windId => {
      if (windId === this.notifyWindowId) {
        this.notifyWindowId = null;
        this.rejectAllApprovals();
      }
    });

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

  activeFirstApproval = async () => {
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
      // Sentry.captureException(
      //   'activeFirstApproval failed: ' + JSON.stringify(e),
      // );
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
      transactionHistoryService.removeSigningTx(approval.signingTxId);
    }

    if (approval && this.approvals.length > 1) {
      this.deleteApproval(approval);
      this.currentApproval = this.approvals[0];
    } else {
      await this.clear(stay);
    }
    this.emit('reject', err);
  };

  requestApproval = async (data: any, winProps?: any): Promise<any> => {
    const origin = this.getOrigin(data);
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
    const currentAccount = preferenceService.getCurrentAccount();
    const reportExplain = (signingTxId?: string) => {
      const signingTx = signingTxId
        ? transactionHistoryService.getSigningTx(signingTxId)
        : null;
      const explain = signingTx?.explain;

      if (explain && currentAccount) {
        // TODO 还没有
        // stats.report('preExecTransaction', {
        //   type: currentAccount.brandName,
        //   category: KEYRING_CATEGORY_MAP[currentAccount.type],
        //   chainId: explain.native_token.chain,
        //   success: explain.calcSuccess && explain.pre_exec.success,
        //   createBy: data?.params.$ctx?.ga ? 'rabby' : 'dapp',
        //   source: data?.params.$ctx?.ga?.source || '',
        //   trigger: data?.params.$ctx?.ga.trigger || '',
        // });
      }
    };
    return new Promise((resolve, reject) => {
      const uuid = uuidv4();
      let signingTxId;
      if (data.approvalComponent === 'SignTx') {
        signingTxId = transactionHistoryService.addSigningTx(
          data.params.data[0],
        );
      } else {
        signingTxId = data?.params?.signingTxId;
      }

      const approval: Approval = {
        taskId: uuid as any,
        id: uuid,
        signingTxId,
        data,
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
      if (
        ['wallet_switchEthereumChain', 'wallet_addEthereumChain'].includes(
          data?.params?.method,
        )
      ) {
        const chainId = data.params?.data?.[0]?.chainId;
        const chain = Object.values(CHAINS).find(chain =>
          new BigNumber(chain.hex).isEqualTo(chainId),
        );

        if (chain) {
          this.resolveApproval(null);
          return;
        }
      }

      if (this.notifyWindowId !== null) {
        presentGlobalBottomSheetModal(this.notifyWindowId);
      } else {
        this.openNotification(approval.winProps);
      }
    });
  };

  clear = async (stay = false) => {
    this.approvals = [];
    this.currentApproval = null;
    if (this.notifyWindowId !== null && !stay) {
      try {
        removeGlobalBottomSheetModal(this.notifyWindowId);
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
    transactionHistoryService.removeAllSigningTx();
  };

  unLock = () => {
    this.isLocked = false;
  };

  lock = () => {
    this.isLocked = true;
  };

  openNotification = (winProps: any, ignoreLock = false) => {
    // Only use ignoreLock flag when approval exist but no notification window exist
    if (!ignoreLock) {
      if (this.isLocked) return;
      this.lock();
    }
    if (this.notifyWindowId !== null) {
      removeGlobalBottomSheetModal(this.notifyWindowId);
      this.notifyWindowId = null;
    }
    this.notifyWindowId = createGlobalBottomSheetModal(winProps);
  };

  setCurrentRequestDeferFn = (fn: () => void) => {
    this.currentRequestDeferFn = fn;
  };

  callCurrentRequestDeferFn = () => {
    return this.currentRequestDeferFn?.();
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

  private getOrigin(data = this.currentApproval?.data) {
    return data?.params?.origin || data?.origin;
  }
}
