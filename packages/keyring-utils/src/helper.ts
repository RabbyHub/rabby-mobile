import EventEmitter from 'events';

export const eventBus = new EventEmitter();

export const SIGN_HELPER_EVENTS = {
  broadcastToUI: 'broadcastToUI',
  broadcastToBackground: 'broadcastToBackground',
  TX_COMPLETED: 'TX_COMPLETED',
  SIGN_FINISHED: 'SIGN_FINISHED',
  TX_SUBMITTING: 'TX_SUBMITTING',
  WALLETCONNECT: {
    STATUS_CHANGED: 'WALLETCONNECT_STATUS_CHANGED',
    SESSION_STATUS_CHANGED: 'SESSION_STATUS_CHANGED',
    SESSION_ACCOUNT_CHANGED: 'SESSION_ACCOUNT_CHANGED',
    SESSION_NETWORK_DELAY: 'SESSION_NETWORK_DELAY',
    INIT: 'WALLETCONNECT_INIT',
    INITED: 'WALLETCONNECT_INITED',
    TRANSPORT_ERROR: 'TRANSPORT_ERROR',
    SCAN_ACCOUNT: 'SCAN_ACCOUNT',
  },
  GNOSIS: {
    TX_BUILT: 'TransactionBuilt',
    TX_CONFIRMED: 'TransactionConfirmed',
  },
  QRHARDWARE: {
    ACQUIRE_MEMSTORE_SUCCEED: 'ACQUIRE_MEMSTORE_SUCCEED',
  },
  LEDGER: {
    REJECTED: 'LEDGER_REJECTED',
    REJECT_APPROVAL: 'LEDGER_REJECT_APPROVAL',
  },
  COMMON_HARDWARE: {
    REJECTED: 'COMMON_HARDWARE_REJECTED',
  },
  LOCK_WALLET: 'LOCK_WALLET',
  RELOAD_TX: 'RELOAD_TX',
};

export const throwError = (
  error: string | undefined,
  method = SIGN_HELPER_EVENTS.COMMON_HARDWARE.REJECTED,
) => {
  eventBus.emit(SIGN_HELPER_EVENTS.broadcastToUI, {
    method,
    params: error,
  });
  throw new Error(error);
};

export class SignHelper {
  signFn: any;

  errorEventName: string;

  constructor(options: { errorEventName: string }) {
    this.errorEventName = options.errorEventName;
  }

  resend() {
    return this.signFn?.();
  }

  resetResend() {
    this.signFn = undefined;
  }

  async invoke(fn: () => Promise<any>) {
    return new Promise(resolve => {
      this.signFn = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e: any) {
          throwError(e.message, this.errorEventName);
        }
      };
      this.signFn();
    });
  }
}
