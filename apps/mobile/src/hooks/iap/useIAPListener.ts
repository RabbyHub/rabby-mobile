import { devLog } from '@/utils/logger';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { openapi } from '@/core/request';
import { eventBus, EVENTS } from '@/utils/events';
import * as Sentry from '@sentry/react-native';
import BigNumber from 'bignumber.js';
import { keyBy } from 'lodash';
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
import { useIAPProducts } from './useIAPProducts';
import { gasAccountProducts } from '@/constant/iap';
import { useMemoizedFn } from 'ahooks';
import { useIAPAccountAddress } from './useIAPAccountAddress';
import { error } from 'console';

export const useIAPListener = () => {
  const [, setProducts] = useIAPProducts();
  const [address] = useIAPAccountAddress();

  const handlePurchase = useMemoizedFn(async (purchase: Purchase) => {
    devLog('purchaseUpdatedListener -> 1', purchase);
    const receipt = purchase.transactionReceipt;
    if (receipt) {
      try {
        if (Platform.OS === 'android') {
          await openapi.confirmIapOrder({
            user_id: purchase.obfuscatedAccountIdAndroid || '',
            transaction_id: purchase.transactionId || '',
            product_id: purchase.productId,
            device_type: 'android',
          });
        } else {
          await openapi.confirmIapOrder({
            user_id: address,
            transaction_id: purchase.transactionId || '',
            product_id: purchase.productId,
            device_type: 'ios',
          });
        }

        finishTransaction({ purchase, isConsumable: true });
        eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase });
      } catch (e) {
        eventBus.emit(EVENTS.PURCHASE_UPDATED, { data: purchase, error: e });
        console.error(e);
      }
    }
  });

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
        const res = await getProducts({
          skus: gasAccountProducts.map(item => item.id),
        });
        if (res.length) {
          setProducts(prev => {
            const dict = keyBy(res, 'productId');
            return prev
              .map(item => {
                if (!dict[item.id]) {
                  return null;
                }
                return {
                  ...item,
                  total: dict[item.id].price,
                  fee: new BigNumber(dict[item.id].price)
                    .minus(item.price)
                    .toString(),
                };
              })
              .filter(item => !!item);
          });
        }
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
  }, [handlePurchase, setProducts]);
};
