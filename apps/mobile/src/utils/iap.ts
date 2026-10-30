import { Platform } from 'react-native';
import { ErrorCode } from 'react-native-iap';
import type { Purchase } from 'react-native-iap';
import { eventBus, EVENTS } from './events';
import { devLog } from './logger';

export const waitPurchaseUpdated = async () => {
  return new Promise<Purchase>((resolve, reject) =>
    eventBus.once(EVENTS.PURCHASE_UPDATED, ({ data, error }) => {
      devLog('purchase updated', data, error);
      if (error || !data) {
        reject(error ?? new Error('Purchase update missing data'));
        return;
      }
      resolve(data);
    }),
  );
};

/**
 * Retries once after rebuilding the store connection when Google Play reports
 * the billing client is not ready.
 */
export const purchaseWithReconnect = async <T>(
  purchase: () => Promise<T>,
  reconnect: () => Promise<void>,
) => {
  try {
    return await purchase();
  } catch (e: any) {
    // The billing flow was never launched, so retrying cannot double charge.
    if (Platform.OS !== 'android' || e?.code !== ErrorCode.NotPrepared) {
      throw e;
    }
    await reconnect();
    return purchase();
  }
};
