import { devLog } from '@/utils/logger';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { gasAccountProducts } from '@/constant/iap';
import { openapi } from '@/core/request';
import { eventBus, EVENTS } from '@/utils/events';
import * as Sentry from '@sentry/react-native';
import { useMemoizedFn } from 'ahooks';
import {
  finishTransaction,
  flushFailedPurchasesCachedAsPendingAndroid,
  getProducts,
  initConnection,
  Purchase,
  PurchaseError,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';

const handlePurchase = async (purchase: Purchase) => {
  devLog('purchaseUpdatedListener -> 1', purchase);
  const receipt = purchase.transactionReceipt;
  if (receipt) {
    try {
      try {
        await openapi.confirmIapOrder(
          Platform.select({
            ios: {
              transaction_id: purchase.transactionId || '',
              product_id: purchase.productId,
              device_type: 'ios',
            },
            android: {
              transaction_id: purchase.purchaseToken || '',
              product_id: purchase.productId,
              device_type: 'android',
            },
          })!,
        );

        eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase });
      } catch (e: any) {
        eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase, error: e });
      }
      finishTransaction({ purchase, isConsumable: true });
    } catch (e: any) {
      eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase, error: e });
      console.error(e);
    }
  }
};

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
        getProducts({
          skus: gasAccountProducts.map(item => item.id),
        });

        devLog('init IAP listener');
        if (Platform.OS === 'android') {
          flushFailedPurchasesCachedAsPendingAndroid();
        }
        purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchase);

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
