import { getRpcTxReceipt } from '@/core/utils/tx';
import { eventBus, EVENTS } from '@/utils/events';

const TX_RECEIPT_POLL_INTERVAL = 5000;

export const waitForTxCompleted = async ({
  hash,
  chainServerId,
  isTaskCancelled,
  createCancelledError = () => new Error('tx wait cancelled'),
  timeoutMs,
}: {
  hash: string;
  chainServerId: string;
  isTaskCancelled?: () => boolean;
  createCancelledError?: () => Error;
  /** no timeout when omitted */
  timeoutMs?: number;
}) => {
  return await new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let isSettled = false;
    let isChecking = false;

    const cleanup = () => {
      isSettled = true;
      eventBus.removeListener(EVENTS.TX_COMPLETED, handler);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const rejectWithCleanup = (error: Error) => {
      cleanup();
      reject(error);
    };

    const rejectIfCancelled = () => {
      if (!isTaskCancelled?.()) {
        return false;
      }

      rejectWithCleanup(createCancelledError());
      return true;
    };

    const scheduleNextCheck = () => {
      if (isSettled || timer) {
        return;
      }

      timer = setTimeout(() => {
        timer = null;
        checkReceipt();
      }, TX_RECEIPT_POLL_INTERVAL);
    };

    const checkReceipt = async () => {
      if (isSettled || isChecking || rejectIfCancelled()) {
        return;
      }

      try {
        isChecking = true;
        const res = await getRpcTxReceipt(chainServerId, hash);
        isChecking = false;

        if (isSettled || rejectIfCancelled()) {
          return;
        }

        if (res.code !== 0) {
          scheduleNextCheck();
          return;
        }

        cleanup();

        if (res.status) {
          resolve(true);
        } else {
          reject(new Error('tx failed'));
        }
      } catch (error) {
        isChecking = false;
        if (isSettled || rejectIfCancelled()) {
          return;
        }
        scheduleNextCheck();
      }
    };

    const handler = (res: { hash?: string }) => {
      if (res?.hash === hash) {
        checkReceipt();
      }
    };

    if (timeoutMs !== undefined) {
      timeoutTimer = setTimeout(() => {
        rejectWithCleanup(new Error('tx receipt timeout'));
      }, timeoutMs);
    }
    eventBus.addListener(EVENTS.TX_COMPLETED, handler);
    checkReceipt();
  });
};
