import { Purchase } from 'react-native-iap';
import { eventBus, EVENTS } from './events';
import { devLog } from './logger';

export const waitPurchaseUpdated = async () => {
  return new Promise<Purchase>(resolve =>
    eventBus.once(EVENTS.PURCHASE_UPDATED, (purchase: Purchase) => {
      devLog('purchase updated');
      resolve(purchase);
    }),
  );
};
