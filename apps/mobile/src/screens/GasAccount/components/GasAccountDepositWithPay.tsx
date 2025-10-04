import {
  RcIconApplePayCC,
  RcIconGooglePayCC,
} from '@/assets2024/icons/gas-account';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { waitPurchaseUpdated } from '@/utils/iap';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import * as Sentry from '@sentry/react-native';
import { useRequest } from 'ahooks';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { ErrorCode, PurchaseError, requestPurchase } from 'react-native-iap';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useGasAccountInfoV2 } from '../hooks';
import { gasAccountProducts } from '@/constant/iap';

interface Props {
  visible?: boolean;
  onDeposit?(): void;
  minDepositPrice?: number;
  gasAccountAddress: string;
}

export const GasAccountDepositWithPay: React.FC<Props> = ({
  visible,
  onDeposit,
  gasAccountAddress,
  minDepositPrice = 0,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });

  const { data: gasAccountInfo } = useGasAccountInfoV2({
    address: gasAccountAddress,
  });

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

  const {
    runAsync: handleDeposit,
    loading: isPurchasing,
    cancel,
  } = useRequest(
    async (product: (typeof products)[0]) => {
      const data = await openapi.createGasAccountPayInfo({
        id: gasAccountAddress,
      });
      if (!data.account?.uuid) {
        throw new Error('get pay info failed');
      }
      await Promise.all([
        waitPurchaseUpdated(),
        requestPurchase(
          Platform.select({
            ios: {
              sku: product.id,
              appAccountToken: data.account.uuid,
            },
            android: {
              skus: [product.id],
              obfuscatedAccountIdAndroid: gasAccountAddress,
            },
          })!,
        ),
      ]);
    },
    {
      manual: true,
      onSuccess() {
        onDeposit?.();
      },
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
    }
  }, [cancel, visible]);

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      scrollEnabled={false}
      keyboardOpeningTime={0}
      // style={styles.container}
      contentContainerStyle={styles.container}>
      <View style={styles.containerHorizontal}>
        <Text style={styles.title}>
          {Platform.OS === 'android'
            ? t('page.gasAccount.depositPayPopup.titleAndroid')
            : t('page.gasAccount.depositPayPopup.titleApple')}
        </Text>
        <Text style={styles.description}>
          {t('page.gasAccount.depositPayPopup.balance')}
          {formatUsdValue(gasAccountInfo?.account?.balance || 0)}
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
      </View>

      <View style={styles.btnContainer}>
        <Button
          type="primary"
          onPress={() => {
            handleDeposit(selectedProduct);
          }}
          buttonStyle={styles.depositWithPayBtn}
          titleStyle={styles.btnTitle}
          loading={isPurchasing}
          disabled={!selectedProduct}
          title={
            <View style={styles.depositWithTitle}>
              <View style={styles.depositWithPayRow}>
                {Platform.OS === 'android' ? (
                  <RcIconGooglePayCC />
                ) : (
                  <Text style={styles.btnTitle}>
                    {t('page.gasAccount.depositPopup.pay')}
                  </Text>
                )}
              </View>
              <Text style={styles.btnDesc}>
                {Platform.OS === 'ios'
                  ? t('page.gasAccount.depositPopup.applePayFeeDesc1')
                  : t('page.gasAccount.depositPopup.googlePayFeeDesc')}
              </Text>
            </View>
          }
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    width: '100%',
    flex: 1,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 18,
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

  btnDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-InvertHighlight'],
    opacity: 0.6,
  },
}));
