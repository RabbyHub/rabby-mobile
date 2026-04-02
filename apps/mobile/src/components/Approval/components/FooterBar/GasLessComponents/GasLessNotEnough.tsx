import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { ThemeColors2024 } from '@/constant/theme';
import { TouchableOpacity, View } from 'react-native';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import { GasAccountDepositTipPopup } from '@/screens/GasAccount/components/GasAccountDepositTipPopup';
import { Text } from '@/components/Typography';
import { GasAccountTopUpWaitCallback } from '@/screens/GasAccount/components/topUpContinuation';
import { useGasAccountInfo } from '@/screens/GasAccount/hooks';
import { formatUsdValue } from '@/utils/number';
import { toast } from '@/components2024/Toast';

export const GasLessNotEnough: React.FC<{
  gasAccountCost?: GasAccountCheckResult;
  gasAccountAddress: string;
  onChangeGasAccount?: () => void;
  canGotoUseGasAccount?: boolean;
  canDepositUseGasAccount?: boolean;
  onDeposit?(): void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  onDepositPopupVisibleChange?: (visible: boolean) => void;
  onGotoGasAccount?(): void;
  inShowMore?: boolean;
}> = ({
  gasAccountCost,
  gasAccountAddress,
  onChangeGasAccount,
  canGotoUseGasAccount,
  canDepositUseGasAccount,
  onDeposit,
  onWaitDepositResult,
  onDepositPopupVisibleChange,
  inShowMore,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const [tipPopupVisible, setTipPopupVisible] = useState(false);
  const setDepositPopupVisible = (visible: boolean) => {
    setTipPopupVisible(visible);
    onDepositPopupVisibleChange?.(visible);
  };

  const { value: gasAccountInfo } = useGasAccountInfo();

  return (
    <>
      <View
        style={[
          styles.container,
          inShowMore && {
            backgroundColor: colors2024['red-light-1'],
          },
        ]}>
        <View
          style={[
            styles.tipTriangle,
            inShowMore && {
              borderBottomColor: colors2024['red-light-1'],
            },
          ]}
        />
        <View>
          <Text
            style={[
              styles.text,
              inShowMore && {
                color: colors2024['red-default'],
              },
            ]}>
            {canDepositUseGasAccount
              ? t('page.signFooterBar.gasAccount.notEnough', {
                  usd: formatUsdValue(gasAccountInfo?.account?.balance || 0),
                })
              : t('page.signFooterBar.gasless.notEnough')}
          </Text>
        </View>

        {canDepositUseGasAccount ? (
          <TouchableOpacity
            style={styles.gasAccountBtn}
            onPress={() => {
              setDepositPopupVisible(true);
            }}>
            <Text style={styles.gasAccountTipBtnText}>
              {t('page.signFooterBar.gasAccount.deposit')}
            </Text>
          </TouchableOpacity>
        ) : canGotoUseGasAccount ? (
          <TouchableOpacity
            style={styles.gasAccountBtn}
            onPress={onChangeGasAccount}>
            <Text style={styles.gasAccountTipBtnText}>
              {t('page.signFooterBar.gasAccount.useGasAccount')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <GasAccountDepositTipPopup
        disableL2Deposit
        gasAccountAddress={gasAccountAddress}
        visible={tipPopupVisible}
        onClose={() => {
          setDepositPopupVisible(false);
        }}
        onDeposit={() => {
          setDepositPopupVisible(false);
          onDeposit?.();
        }}
        onWaitDepositResult={async result => {
          toast.success(t('page.gasAccount.depositSuccess'));
          setDepositPopupVisible(false);
          await onWaitDepositResult?.(result);
        }}
        minDepositPrice={gasAccountCost?.gas_account_cost?.total_cost}
      />
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingLeft: 12,
      paddingRight: 5,
      borderRadius: 8,
      position: 'relative',
      marginBottom: 8,
      marginTop: 5,
      minHeight: 36,
      backgroundColor: colors2024['red-light-1'],
    },
    tipTriangle: {
      position: 'absolute',
      top: -20,
      left: 10,
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 10,
      borderBottomWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: 'transparent',
      alignItems: 'center',
      borderBottomColor: colors2024['red-light-1'],
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 18,
      color: colors2024['red-default'],
    },

    gasAccountBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 72,
      height: 28,
      backgroundColor: colors2024['brand-default'],
      borderRadius: 6,
      marginLeft: 'auto',
      paddingHorizontal: 12,
    },
    gasAccountTipBtnText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: '700',
      color: isLight
        ? ThemeColors2024.dark['neutral-title-1']
        : ThemeColors2024.light['neutral-title-1'],
      lineHeight: 16,
    },
  };
});
