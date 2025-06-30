import { Purchase } from 'react-native-iap';
import { eventBus, EVENTS } from './events';
import { devLog } from './logger';

export const waitPurchaseUpdated = async () => {
  return new Promise<Purchase>((resolve, reject) =>
    eventBus.once(EVENTS.PURCHASE_UPDATED, ({ data, error }) => {
      devLog('purchase updated', data, error);
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    }),
  );
};
