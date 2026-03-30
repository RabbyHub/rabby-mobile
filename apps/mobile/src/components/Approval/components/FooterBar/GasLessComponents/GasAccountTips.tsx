import { ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountDepositTipPopup } from '@/screens/GasAccount/components/GasAccountDepositTipPopup';
import { GasAccountDepositWithTokenAlertModal } from '@/screens/GasAccount/components/GasAccountDepositWithTokenAlertModal';
import { GasAccountTopUpWaitCallback } from '@/screens/GasAccount/components/topUpContinuation';
import { createGetStyles2024 } from '@/utils/styles';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';
import { GAS_ACCOUNT_INSUFFICIENT_TIP } from '@/screens/GasAccount/hooks/checkTsx';

export const GasAccountTips: React.FC<{
  gasAccountCost?: GasAccountCheckResult;
  gasAccountAddress: string;
  onDeposit?(): void;
  onWaitDepositResult?: GasAccountTopUpWaitCallback;
  onDepositPopupVisibleChange?: (visible: boolean) => void;
  disableDepositAction?: boolean;
  isGasAccountLogin?: boolean;
  isWalletConnect?: boolean;
  noCustomRPC?: boolean;
  onGotoGasAccount?: () => void;
  inShowMore?: boolean;
}> = ({
  gasAccountCost,
  isGasAccountLogin,
  isWalletConnect,
  noCustomRPC,
  onGotoGasAccount,
  onDeposit,
  onWaitDepositResult,
  onDepositPopupVisibleChange,
  disableDepositAction,
  gasAccountAddress,
  inShowMore = true,
}) => {
  const { t } = useTranslation();

  const { styles, colors2024 } = useTheme2024({ getStyle });

  const [tipPopupVisible, setTipPopupVisible] = useState(false);

  const [tip, btnText] = useMemo(() => {
    if (!noCustomRPC) {
      return [t('page.signFooterBar.gasAccount.customRPC'), null];
    }
    if (isWalletConnect) {
      return [t('page.signFooterBar.gasAccount.WalletConnectTips'), null];
    }

    if (gasAccountCost?.err_msg) {
      if (
        !gasAccountCost?.chain_not_support &&
        gasAccountCost?.err_msg?.toLowerCase() ===
          GAS_ACCOUNT_INSUFFICIENT_TIP.toLowerCase()
      ) {
        return [
          t('page.signFooterBar.gasAccount.notEnough', {
            usd: gasAccountCost?.gas_account_cost?.total_cost,
          }),
          disableDepositAction
            ? null
            : t('page.signFooterBar.gasAccount.deposit'),
        ];
      }
      return [gasAccountCost.err_msg, null];
    }
    // if (!isGasAccountLogin) {
    //   return [
    //     t('page.signFooterBar.gasAccount.loginFirst'),
    //     t('page.signFooterBar.gasAccount.login'),
    //   ];
    // }
    if (gasAccountCost?.chain_not_support) {
      return [t('page.signFooterBar.gasAccount.chainNotSupported'), null];
    }
    if (!gasAccountCost?.balance_is_enough) {
      return [
        // inShowMore
        //   ? t('page.signFooterBar.gasless.notEnough')
        //   : t('page.signFooterBar.gasAccount.notEnough'),
        t('page.signFooterBar.gasAccount.notEnough', {
          usd: gasAccountCost?.gas_account_cost?.total_cost,
        }),
        disableDepositAction
          ? null
          : t('page.signFooterBar.gasAccount.deposit'),
      ];
    }
    return [null, null];
  }, [
    // inShowMore,
    noCustomRPC,
    isWalletConnect,
    gasAccountCost?.chain_not_support,
    gasAccountCost?.balance_is_enough,
    gasAccountCost?.gas_account_cost?.total_cost,
    gasAccountCost?.err_msg,
    disableDepositAction,
    t,
  ]);

  useEffect(() => {
    return () => {
      setTipPopupVisible(false);
      onDepositPopupVisibleChange?.(false);
    };
  }, [onDepositPopupVisibleChange]);

  if (
    !isWalletConnect &&
    gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support &&
    noCustomRPC &&
    !gasAccountCost?.err_msg
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        inShowMore && { backgroundColor: colors2024['red-light-1'] },
      ]}>
      <View
        style={[
          styles.tipTriangle,
          inShowMore && {
            left: 10,
            borderBottomColor: colors2024['red-light-1'],
          },
        ]}
      />
      <Text
        style={[
          styles.text,
          inShowMore && { color: colors2024['red-default'] },
        ]}>
        {tip}
      </Text>
      {btnText ? (
        <TouchableOpacity
          style={styles.gasAccountBtn}
          onPress={() => {
            onDepositPopupVisibleChange?.(true);
            setTipPopupVisible(true);
          }}>
          <Text style={styles.gasAccountTipBtnText}>{btnText}</Text>
        </TouchableOpacity>
      ) : null}
      <GasAccountDepositTipPopup
        gasAccountAddress={gasAccountAddress}
        visible={
          // !isWalletConnect && isGasAccountLogin ? tipPopupVisible : false
          !isWalletConnect ? tipPopupVisible : false
        }
        onClose={() => {
          setTipPopupVisible(false);
          onDepositPopupVisibleChange?.(false);
        }}
        onDeposit={() => {
          setTipPopupVisible(false);
          onDepositPopupVisibleChange?.(false);
          onDeposit?.();
        }}
        onWaitDepositResult={async result => {
          setTipPopupVisible(false);
          onDepositPopupVisibleChange?.(false);
          await onWaitDepositResult?.(result);
        }}
        // onGotoGasAccount={() => {
        //   setTipPopupVisible(false);
        //   onGotoGasAccount?.();
        // }}
        minDepositPrice={gasAccountCost?.gas_account_cost?.total_cost}
      />

      {/* <GasAccountLogInTipPopup
        visible={
          !isWalletConnect && !isGasAccountLogin ? tipPopupVisible : false
        }
        onClose={() => setTipPopupVisible(false)}
      /> */}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      // backgroundColor: colors2024['neutral-bg-4'],
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
      // borderBottomColor: colors2024['neutral-bg-4'],
      alignItems: 'center',
      borderBottomColor: colors2024['red-light-1'],
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '500',
      // color: colors2024['neutral-body'],
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
