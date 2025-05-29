import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { ThemeColors2024 } from '@/constant/theme';
import { Text, TouchableOpacity, View } from 'react-native';
import { GasAccountCheckResult } from '@rabby-wallet/rabby-api/dist/types';
import { GasAccountDepositTipPopup } from '@/screens/GasAccount/components/GasAccountDepositTipPopup';

export const GasLessNotEnough: React.FC<{
  gasAccountCost?: GasAccountCheckResult;
  gasAccountAddress: string;
  onChangeGasAccount?: () => void;
  canGotoUseGasAccount?: boolean;
  canDepositUseGasAccount?: boolean;
  onDeposit?(): void;
  onGotoGasAccount?(): void;
  inShowMore?: boolean;
}> = ({
  gasAccountCost,
  gasAccountAddress,
  onChangeGasAccount,
  canGotoUseGasAccount,
  canDepositUseGasAccount,
  onDeposit,
  onGotoGasAccount,
  inShowMore,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const [tipPopupVisible, setTipPopupVisible] = useState(false);

  useEffect(() => {
    return () => {
      setTipPopupVisible(false);
    };
  }, []);

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
            {t('page.signFooterBar.gasless.notEnough')}
          </Text>
        </View>

        {canDepositUseGasAccount ? (
          <TouchableOpacity
            style={[styles.gasAccountBtn]}
            onPress={() => {
              setTipPopupVisible(true);
            }}>
            <Text style={styles.gasAccountTipBtnText}>
              {t('page.signFooterBar.gasAccount.deposit')}
            </Text>
          </TouchableOpacity>
        ) : canGotoUseGasAccount ? (
          <TouchableOpacity
            style={[styles.gasAccountBtn]}
            onPress={onChangeGasAccount}>
            <Text style={styles.gasAccountTipBtnText}>
              {t('page.signFooterBar.gasAccount.useGasAccount')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <GasAccountDepositTipPopup
        gasAccountAddress={gasAccountAddress}
        visible={tipPopupVisible}
        onClose={() => setTipPopupVisible(false)}
        onDeposit={() => {
          setTipPopupVisible(false);
          onDeposit?.();
        }}
        onGotoGasAccount={() => {
          setTipPopupVisible(false);
          onGotoGasAccount?.();
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
