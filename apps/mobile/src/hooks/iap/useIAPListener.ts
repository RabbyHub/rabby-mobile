import { devLog } from '@/utils/logger';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { gasAccountProducts } from '@/constant/iap';
import { openapi } from '@/core/request';
import { eventBus, EVENTS } from '@/utils/events';
import * as Sentry from '@sentry/react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import type { Purchase, PurchaseError } from 'react-native-iap';

const handlePurchase = async (purchase: Purchase) => {
  devLog('purchaseUpdatedListener -> 1', purchase);
  const receipt = purchase.id;
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

const handlePurchaseError = (error: PurchaseError) => {
  // payment error
  devLog('purchaseErrorListener', error);
  eventBus.emit(EVENTS.PURCHASE_UPDATED, { error });
};

let purchaseUpdateSubscription: ReturnType<
  typeof purchaseUpdatedListener
> | null = null;
let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener> | null =
  null;

// Listeners must not depend on initConnection succeeding: requestPurchase
// reconnects natively, and a purchase made then would otherwise never reach JS.
// Both handlers are stable references, so calling this again is idempotent and
// also attaches the native bridge if it was not ready the first time.
const attachListeners = () => {
  purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchase);
  purchaseErrorSubscription = purchaseErrorListener(handlePurchaseError);
};

const detachListeners = () => {
  purchaseUpdateSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription?.remove();
  purchaseErrorSubscription = null;
};

const captureIAPError = (error: PurchaseError) => {
  Sentry.captureException(error, {
    extra: {
      code: error?.code,
      responseCode: error?.responseCode,
      debugMessage: error?.debugMessage,
    },
  });
};

const connect = async () => {
  try {
    attachListeners();
    await initConnection();
    attachListeners();
    devLog('init IAP listener');
    fetchProducts({
      skus: gasAccountProducts.map(item => item.id),
    }).catch(error => devLog('fetchProducts error', error));
  } catch (error: any) {
    devLog('initConnection error', error);
    captureIAPError(error);
  }
};

/**
 * react-native-iap 16 keeps reporting itself initialized after Google Play
 * drops the billing service, so purchases fail with `not-prepared` until the
 * connection is rebuilt. endConnection also drops every listener, which
 * connect() registers again.
 */
export const reconnectIAP = async () => {
  try {
    await endConnection();
  } catch (error) {
    devLog('endConnection error', error);
  }
  await connect();
};

export const useIAPListener = () => {
  useEffect(() => {
    connect();

    return detachListeners;
  }, []);
};
