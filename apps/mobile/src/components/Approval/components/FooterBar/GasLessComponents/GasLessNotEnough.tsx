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
import { formatUsdValue } from '@/utils/number';
import { toast } from '@/components2024/Toast';
import { usePendingHardwareGasAccountLogin } from './usePendingHardwareGasAccountLogin';
import { useGasAccountBalance } from './useGasAccountBalance';
import { setGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';

type ActionButton = {
  text: string;
  onPress?: () => void;
  disabled: boolean;
};

export const GasLessNotEnough: React.FC<{
  gasAccountCost?: GasAccountCheckResult;
  gasAccountAddress: string;
  onChangeGasAccount?: () => void;
  canGotoUseGasAccount?: boolean;
  canDepositUseGasAccount?: boolean;
  onDeposit?(): void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  onDepositPopupVisibleChange?: (visible: boolean) => void;
  nativeTokenInsufficient?: boolean;
  inShowMore?: boolean;
  fallbackDirectSignToOpenUI?: boolean;
}> = ({
  gasAccountCost,
  gasAccountAddress,
  onChangeGasAccount,
  canGotoUseGasAccount,
  canDepositUseGasAccount,
  onDeposit,
  onWaitDepositResult,
  onDepositPopupVisibleChange,
  nativeTokenInsufficient,
  inShowMore,
  fallbackDirectSignToOpenUI,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const [tipPopupVisible, setTipPopupVisible] = useState(false);
  const setDepositPopupVisible = (visible: boolean) => {
    setGasAccountDepositFlowActive(visible);
    setTipPopupVisible(visible);
    onDepositPopupVisibleChange?.(visible);
  };

  const gasAccountBalance = useGasAccountBalance(gasAccountAddress);

  const {
    shouldSignWithPendingHardware,
    pendingHardwareBrandLabel,
    isLoggingPendingHardware,
    handleSignWithPendingHardware,
  } = usePendingHardwareGasAccountLogin({
    enabled: !!nativeTokenInsufficient,
    gasAccountCost,
    currentGasAccountAddress: gasAccountAddress,
    onLoggedIn: onChangeGasAccount,
  });
  const signWithHardwareBrand =
    pendingHardwareBrandLabel || t('page.home.addAddress.hardwareWallet');
  const signWithHardwareTip = t(
    'page.signFooterBar.gasAccount.signWithHardwareWalletToUse',
    {
      brand: signWithHardwareBrand,
    },
  );
  const notEnoughTip = t('page.signFooterBar.gasAccount.notEnough', {
    usd: formatUsdValue(gasAccountBalance),
  });
  const depositButton: ActionButton = {
    text: t('page.signFooterBar.gasAccount.deposit'),
    onPress: () => setDepositPopupVisible(true),
    disabled: false,
  };
  const switchGasAccountButton: ActionButton = {
    text: t('page.signFooterBar.gasAccount.useGasAccount'),
    onPress: onChangeGasAccount,
    disabled: false,
  };

  const tipText = shouldSignWithPendingHardware
    ? signWithHardwareTip
    : canDepositUseGasAccount
    ? notEnoughTip
    : t('page.signFooterBar.gasless.notEnough');

  let button: ActionButton | null = null;
  if (shouldSignWithPendingHardware) {
    button = {
      text: t('page.signFooterBar.signAndSubmitButton'),
      onPress: handleSignWithPendingHardware,
      disabled: isLoggingPendingHardware,
    };
  } else if (canDepositUseGasAccount) {
    button = depositButton;
  } else if (canGotoUseGasAccount) {
    button = switchGasAccountButton;
  }

  const useHardwareSignTipStyle = shouldSignWithPendingHardware;
  const useRedTipStyle = !useHardwareSignTipStyle && !!inShowMore;

  return (
    <>
      <View
        style={[
          styles.container,
          useHardwareSignTipStyle && styles.hardwareSignContainer,
          useRedTipStyle && styles.redTipContainer,
        ]}>
        <View
          style={[
            styles.tipTriangle,
            useRedTipStyle && styles.redTipTriangle,
            useHardwareSignTipStyle && styles.hardwareSignTipTriangle,
          ]}
        />
        <View style={[styles.textWrap, button && styles.textWrapWithButton]}>
          <Text
            style={[
              styles.text,
              useHardwareSignTipStyle && styles.hardwareSignText,
              useRedTipStyle && styles.redTipText,
            ]}>
            {tipText}
          </Text>
        </View>

        {button ? (
          <TouchableOpacity
            style={styles.gasAccountBtn}
            disabled={button.disabled}
            onPress={button.onPress}>
            <Text style={styles.gasAccountTipBtnText}>{button.text}</Text>
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
        fallbackDirectSignToOpenUI={fallbackDirectSignToOpenUI}
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
      flexShrink: 1,
    },
    textWrap: {
      flex: 1,
      minWidth: 0,
    },
    textWrapWithButton: {
      marginRight: 12,
    },
    redTipContainer: {
      backgroundColor: colors2024['red-light-1'],
    },
    redTipTriangle: {
      borderBottomColor: colors2024['red-light-1'],
    },
    redTipText: {
      color: colors2024['red-default'],
    },
    hardwareSignContainer: {
      backgroundColor: colors2024['neutral-bg-2'],
    },
    hardwareSignText: {
      color: colors2024['neutral-title-1'],
    },
    hardwareSignTipTriangle: {
      borderBottomColor: colors2024['neutral-bg-2'],
    },

    gasAccountBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 72,
      height: 28,
      backgroundColor: colors2024['brand-default'],
      borderRadius: 6,
      flexShrink: 0,
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
