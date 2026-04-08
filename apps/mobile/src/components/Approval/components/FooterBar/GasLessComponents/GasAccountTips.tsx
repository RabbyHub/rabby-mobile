import { ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountDepositTipPopup } from '@/screens/GasAccount/components/GasAccountDepositTipPopup';
import { GasAccountTopUpWaitCallback } from '@/screens/GasAccount/components/topUpContinuation';
import { createGetStyles2024 } from '@/utils/styles';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';
import { GAS_ACCOUNT_INSUFFICIENT_TIP } from '@/screens/GasAccount/hooks/checkTsx';
import { formatUsdValue } from '@/utils/number';
import { toast } from '@/components2024/Toast';
import { usePendingHardwareGasAccountLogin } from './usePendingHardwareGasAccountLogin';
import { useGasAccountBalance } from './useGasAccountBalance';

type ActionButton = {
  text: string;
  onPress: () => void;
  disabled: boolean;
};

export const GasAccountTips: React.FC<{
  gasAccountCost?: GasAccountCheckResult;
  gasAccountAddress: string;
  onChangeGasAccount?: () => void;
  onDeposit?(): void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  onDepositPopupVisibleChange?: (visible: boolean) => void;
  disableDepositAction?: boolean;
  isWalletConnect?: boolean;
  noCustomRPC?: boolean;
  nativeTokenInsufficient?: boolean;
  inShowMore?: boolean;
}> = ({
  gasAccountCost,
  isWalletConnect,
  noCustomRPC,
  nativeTokenInsufficient,
  onDeposit,
  onChangeGasAccount,
  onWaitDepositResult,
  onDepositPopupVisibleChange,
  disableDepositAction,
  gasAccountAddress,
  inShowMore = true,
}) => {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  const [tipPopupVisible, setTipPopupVisible] = useState(false);

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

  const setDepositPopupVisible = (visible: boolean) => {
    setTipPopupVisible(visible);
    onDepositPopupVisibleChange?.(visible);
  };

  const depositButtonText = disableDepositAction
    ? null
    : t('page.signFooterBar.gasAccount.deposit');
  const notEnoughTipText = t('page.signFooterBar.gasAccount.notEnough', {
    usd: formatUsdValue(gasAccountBalance),
  });
  const depositButton = depositButtonText
    ? {
        text: depositButtonText,
        onPress: () => setDepositPopupVisible(true),
        disabled: false,
      }
    : null;

  let tip: string | null = null;
  let button: ActionButton | null = null;

  if (!noCustomRPC) {
    tip = t('page.signFooterBar.gasAccount.customRPC');
  } else if (isWalletConnect) {
    tip = t('page.signFooterBar.gasAccount.WalletConnectTips');
  } else if (shouldSignWithPendingHardware) {
    tip = t('page.signFooterBar.gasAccount.signWithHardwareWalletToUse', {
      brand:
        pendingHardwareBrandLabel || t('page.home.addAddress.hardwareWallet'),
    });
    button = {
      text: t('page.signFooterBar.signAndSubmitButton'),
      onPress: handleSignWithPendingHardware,
      disabled: isLoggingPendingHardware,
    };
  } else if (gasAccountCost?.err_msg) {
    const isInsufficientError =
      !gasAccountCost.chain_not_support &&
      gasAccountCost.err_msg.toLowerCase() ===
        GAS_ACCOUNT_INSUFFICIENT_TIP.toLowerCase();
    if (isInsufficientError) {
      tip = notEnoughTipText;
      button = depositButton;
    } else {
      tip = gasAccountCost.err_msg;
    }
  } else if (gasAccountCost?.chain_not_support) {
    tip = t('page.signFooterBar.gasAccount.chainNotSupported');
  } else if (!gasAccountCost?.balance_is_enough) {
    tip = notEnoughTipText;
    button = depositButton;
  }

  if (
    !isWalletConnect &&
    gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support &&
    noCustomRPC &&
    !gasAccountCost?.err_msg &&
    !shouldSignWithPendingHardware
  ) {
    return null;
  }

  const useHardwareSignTipStyle = shouldSignWithPendingHardware;
  const useRedTipStyle = !useHardwareSignTipStyle && inShowMore;

  return (
    <View
      style={[
        styles.container,
        useHardwareSignTipStyle && styles.hardwareSignContainer,
        useRedTipStyle && styles.redTipContainer,
      ]}>
      <View
        style={[
          styles.tipTriangle,
          useRedTipStyle && styles.tipTriangleInShowMore,
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
          {tip}
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
      <GasAccountDepositTipPopup
        disableL2Deposit
        gasAccountAddress={gasAccountAddress}
        visible={!isWalletConnect && tipPopupVisible}
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
    </View>
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
      left: 40,
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
    tipTriangleInShowMore: {
      left: 10,
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
