import { devLog } from '@/utils/logger';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import * as Sentry from '@sentry/react-native';
import {
  finishTransaction,
  flushFailedPurchasesCachedAsPendingAndroid,
  initConnection,
  Purchase,
  PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import { eventBus, EVENTS } from '@/utils/events';

export const useIAPListener = () => {
  useEffect(() => {
    let purchaseUpdateSubscription: ReturnType<
      typeof purchaseErrorListener
    > | null;
    let purchaseErrorSubscription: ReturnType<
      typeof purchaseErrorListener
    > | null;

    const init = async () => {
      try {
        await initConnection();
        devLog('init IAP listener');
        if (Platform.OS === 'android') {
          flushFailedPurchasesCachedAsPendingAndroid();
        }
        purchaseUpdateSubscription = purchaseUpdatedListener(
          (purchase: Purchase) => {
            devLog('purchaseUpdatedListener -> 1', purchase);
            const receipt = purchase.transactionReceipt;
            if (receipt) {
              // todo  调后端接口
              console.log({
                receipt: purchase.transactionReceipt, // 购买凭证
                productId: purchase.productId, // 产品ID
                transactionId: purchase.transactionId, // 交易ID
              });
              finishTransaction({ purchase, isConsumable: true });
              eventBus.emit(EVENTS.PURCHASE_UPDATED, purchase);
            }
          },
        );

        purchaseErrorSubscription = purchaseErrorListener(
          (error: PurchaseError) => {
            // payment error
            error;
            devLog('purchaseErrorListener', error);
          },
        );
      } catch (error: any) {
        devLog('initConnection error', error);
        Sentry.captureException(error);
      }
    };

    init();

    return () => {
      purchaseUpdateSubscription?.remove();
      purchaseUpdateSubscription = null;
      purchaseErrorSubscription?.remove();
      purchaseErrorSubscription = null;
    };
  }, []);
};
