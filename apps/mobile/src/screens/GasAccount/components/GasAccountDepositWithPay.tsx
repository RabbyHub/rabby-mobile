import {
  RcIconApplePayCC,
  RcIconGooglePayCC,
} from '@/assets2024/icons/gas-account';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { pollDepositStatus } from '@/core/apis/gasAccount';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { waitPurchaseUpdated } from '@/utils/iap';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import * as Sentry from '@sentry/react-native';
import { useRequest } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { ErrorCode, PurchaseError, requestPurchase } from 'react-native-iap';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { gasAccountProducts } from '@/constant/iap';
import { Text } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';
import { GasAccountTopUpWaitCallback } from './topUpContinuation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveDepositPayProduct } from './GasAccountDepositAutoFill.utils';
import BigNumber from 'bignumber.js';

interface Props {
  visible?: boolean;
  onDeposit?(): void;
  onClose?(): void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  minDepositPrice?: number;
  gasAccountAddress?: string;
  onEnsureGasAccountAddress?(): Promise<string>;
}

export const GasAccountDepositWithPay: React.FC<Props> = ({
  visible,
  onDeposit,
  onClose,
  onWaitDepositResult,
  gasAccountAddress,
  minDepositPrice = 0,
  onEnsureGasAccountAddress,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const pollCancelRef = useRef<(() => void) | null>(null);
  const [resolvedGasAccountAddress, setResolvedGasAccountAddress] = useState<
    string | undefined
  >(gasAccountAddress);

  const products = useMemo(() => {
    const res = gasAccountProducts
      .filter(item => +item.price > +minDepositPrice)
      .slice(0, 3);
    if (!res.length) {
      return gasAccountProducts.slice(gasAccountProducts.length - 1);
    }
    return res;
  }, [minDepositPrice]);
  const [selectedProduct, setSelectedProduct] = useState(products[0]);

  const { data: gasAccountInfo, runAsync: fetchGasAccountInfo } = useRequest(
    async (address: string) => {
      return openapi.getGasAccountInfoV2({ id: address });
    },
    {
      manual: true,
    },
  );

  useEffect(() => {
    if (gasAccountAddress) {
      setResolvedGasAccountAddress(gasAccountAddress);
      fetchGasAccountInfo(gasAccountAddress);
    }
  }, [fetchGasAccountInfo, gasAccountAddress]);

  const {
    runAsync: handleDeposit,
    loading: isPurchasing,
    cancel,
  } = useRequest(
    async (product: (typeof products)[0]) => {
      let targetGasAccountAddress =
        resolvedGasAccountAddress || gasAccountAddress;

      if (!targetGasAccountAddress) {
        targetGasAccountAddress = await onEnsureGasAccountAddress?.();
        if (!targetGasAccountAddress) {
          throw new Error('get pay info failed');
        }
        setResolvedGasAccountAddress(targetGasAccountAddress);
        await fetchGasAccountInfo(targetGasAccountAddress);
      }

      const data = await openapi.createGasAccountPayInfo({
        id: targetGasAccountAddress,
      });
      if (!data.account?.uuid) {
        throw new Error('get pay info failed');
      }
      const [purchase] = await Promise.all([
        waitPurchaseUpdated(),
        requestPurchase(
          Platform.select({
            ios: {
              sku: product.id,
              appAccountToken: data.account.uuid,
            },
            android: {
              skus: [product.id],
              obfuscatedAccountIdAndroid: targetGasAccountAddress,
            },
          })!,
        ),
      ]);

      if (onWaitDepositResult) {
        const transactionId = Platform.select({
          ios: purchase.transactionId || '',
          android: purchase.purchaseToken || '',
        })!;

        const { promise: pollPromise, cancel } = pollDepositStatus({
          params: {
            transaction_id: transactionId,
            product_id: product.id,
            device_type: IS_ANDROID ? 'android' : 'ios',
          },
        });
        pollCancelRef.current = cancel;
        const success = await pollPromise;
        pollCancelRef.current = null;

        if (success) {
          await onWaitDepositResult({
            type: 'pay',
          });
          onDeposit?.();
          onClose?.();
        } else {
          toast.info(t('page.gasAccount.depositFailed'), {
            position: toast.positions.CENTER,
          });
          onClose?.();
        }
        return;
      }

      onDeposit?.();
    },
    {
      manual: true,
      onError(e: any) {
        console.error(e);
        Sentry.captureException(e);
        if (
          e instanceof PurchaseError &&
          e.code === ErrorCode.E_USER_CANCELLED
        ) {
          toast.error(t('page.gasAccount.depositPayPopup.depositCanceled'), {
            position: toast.positions.CENTER,
          });
        } else {
          toast.error(t('page.gasAccount.depositPayPopup.depositFailed'), {
            position: toast.positions.CENTER,
          });
        }
      },
    },
  );

  useEffect(() => {
    if (!visible) {
      cancel();
      pollCancelRef.current?.();
    }
  }, [cancel, visible]);
  const { bottom } = useSafeAreaInsets();

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      scrollEnabled={false}
      keyboardOpeningTime={0}
      // style={styles.container}
      contentContainerStyle={StyleSheet.flatten([
        styles.container,
        { paddingBottom: Math.max(bottom, 36) },
      ])}>
      <View style={styles.containerHorizontal}>
        <Text style={styles.title}>
          {Platform.OS === 'android'
            ? t('page.gasAccount.depositPayPopup.titleAndroid')
            : t('page.gasAccount.depositPayPopup.titleApple')}
        </Text>

        <Text style={styles.tokenLabel}>
          {t('page.gasAccount.depositPopup.amount')}
        </Text>
        <View style={styles.amountSelector}>
          {products.map(item => (
            <CustomTouchableOpacity
              key={item.id}
              onPress={() => setSelectedProduct(item)}
              style={[
                styles.amountButton,
                selectedProduct?.id === item.id && styles.selectedAmountButton,
              ]}>
              <Text style={styles.amountText}>${item.price}</Text>
            </CustomTouchableOpacity>
          ))}
        </View>
        {minDepositPrice ? (
          <Text style={styles.tips}>
            {t('page.gasAccount.depositPayPopup.topUpPayTips', {
              topUpUsd: formatUsdValue(minDepositPrice),
              balance: formatUsdValue(
                selectedProduct?.price
                  ? new BigNumber(selectedProduct?.price)
                      .plus(gasAccountInfo?.account?.balance || 0)
                      .minus(minDepositPrice)
                      .toFixed()
                  : gasAccountInfo?.account?.balance || 0,
              ),
            })}
          </Text>
        ) : null}
      </View>

      <View style={styles.btnContainer}>
        <Button
          type="primary"
          onPress={() => {
            if (selectedProduct) {
              handleDeposit(selectedProduct);
            }
          }}
          buttonStyle={styles.depositWithPayBtn}
          titleStyle={styles.btnTitle}
          loading={isPurchasing}
          disabled={!selectedProduct}
          title={
            <View style={styles.depositWithTitle}>
              <View style={styles.depositWithPayRow}>
                {Platform.OS === 'android' ? (
                  <RcIconGooglePayCC
                    color={colors2024['neutral-InvertHighlight']}
                  />
                ) : (
                  <Text style={styles.btnTitle}>
                    {t('page.gasAccount.depositPopup.pay')}
                  </Text>
                )}
                <Text style={styles.btnTitle}>${selectedProduct?.total}</Text>
              </View>
            </View>
          }
        />
        <Text style={[styles.tips, styles.feeTips]}>
          {Platform.OS === 'ios'
            ? t('page.gasAccount.depositPopup.applePayFeeDesc1')
            : t('page.gasAccount.depositPopup.googlePayFeeDesc')}
        </Text>
      </View>
    </KeyboardAwareScrollView>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    width: '100%',
    flex: 1,
    paddingBottom: 48,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 24,
    textAlign: 'center',
  },

  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },

  btnContainer: {
    marginTop: 26,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },

  depositWithPayBtn: {
    height: 60,
    ...(isLight
      ? {
          backgroundColor: '#000',
        }
      : {
          backgroundColor: colors2024['neutral-bg-2'],
          borderWidth: 1,
          borderColor: colors2024['neutral-line'],
        }),
  },
  depositWithTitle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  depositWithPayRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },
  tips: {
    marginTop: 2,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },

  feeTips: {
    marginTop: 20,
    textAlign: 'center',
  },
}));
