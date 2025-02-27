import { ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountDepositTipPopup } from '@/screens/GasAccount/components/GasAccountDepositTipPopup';
import { createGetStyles2024 } from '@/utils/styles';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

export const GasAccountTips: React.FC<{
  gasAccountCost?: GasAccountCheckResult;
  isGasAccountLogin?: boolean;
  isWalletConnect?: boolean;
  noCustomRPC?: boolean;
  onGotoGasAccount?: () => void;
}> = ({
  gasAccountCost,
  isGasAccountLogin,
  isWalletConnect,
  noCustomRPC,
  onGotoGasAccount,
}) => {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  const [tipPopupVisible, setTipPopupVisible] = useState(false);

  const [tip, btnText] = useMemo(() => {
    if (!noCustomRPC) {
      return [t('page.signFooterBar.gasAccount.customRPC'), null];
    }
    if (isWalletConnect) {
      return [t('page.signFooterBar.gasAccount.WalletConnectTips'), null];
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
        t('page.signFooterBar.gasAccount.notEnough'),
        t('page.signFooterBar.gasAccount.deposit'),
      ];
    }
    return [null, null];
  }, [
    noCustomRPC,
    isWalletConnect,
    gasAccountCost?.chain_not_support,
    gasAccountCost?.balance_is_enough,
    t,
  ]);

  useEffect(() => {
    return () => {
      setTipPopupVisible(false);
    };
  }, []);

  if (
    !isWalletConnect &&
    isGasAccountLogin &&
    gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support &&
    noCustomRPC
  ) {
    return null;
  }

  return (
    <View style={[styles.container]}>
      <View style={styles.tipTriangle} />
      <Text style={[styles.text]}>{tip}</Text>
      {btnText ? (
        <TouchableOpacity
          style={styles.gasAccountBtn}
          onPress={() => setTipPopupVisible(true)}>
          <Text style={styles.gasAccountTipBtnText}>{btnText}</Text>
        </TouchableOpacity>
      ) : null}
      <GasAccountDepositTipPopup
        gasAccountAddress="//todo"
        visible={
          // !isWalletConnect && isGasAccountLogin ? tipPopupVisible : false
          !isWalletConnect ? tipPopupVisible : false
        }
        onClose={() => setTipPopupVisible(false)}
        onDeposit={() => {
          setTipPopupVisible(false);
          // todo
        }}
        onGotoGasAccount={() => {
          setTipPopupVisible(false);
          onGotoGasAccount?.();
        }}
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
      backgroundColor: colors2024['neutral-bg-4'],
      paddingVertical: 4,
      paddingLeft: 12,
      paddingRight: 5,
      borderRadius: 8,
      position: 'relative',
      marginBottom: 8,
      marginTop: 5,
      minHeight: 36,
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
      borderBottomColor: colors2024['neutral-bg-4'],
      alignItems: 'center',
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '500',
      color: colors2024['neutral-body'],
      lineHeight: 18,
    },

    gasAccountBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 72,
      height: 28,
      backgroundColor: colors2024['brand-default'],
      borderRadius: 100,
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
