import React from 'react';

import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { ThemeColors2024 } from '@/constant/theme';
import { Text, TouchableOpacity, View } from 'react-native';

export const GasLessNotEnough: React.FC<{
  onChangeGasAccount?: () => void;
  canGotoUseGasAccount?: boolean;
  canDepositUseGasAccount?: boolean;
}> = ({
  onChangeGasAccount,
  canGotoUseGasAccount,
  canDepositUseGasAccount,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, {}]}>
      <View style={styles.tipTriangle} />
      <View>
        <Text style={[styles.text]}>
          {t('page.signFooterBar.gasless.notEnough')}
        </Text>
      </View>

      {canGotoUseGasAccount ? (
        <TouchableOpacity
          style={[styles.gasAccountBtn]}
          onPress={onChangeGasAccount}>
          <Text style={styles.gasAccountTipBtnText}>
            {t('page.signFooterBar.gasAccount.useGasAccount')}
          </Text>
        </TouchableOpacity>
      ) : null}
      {/* //todo */}
      {canDepositUseGasAccount ? (
        <TouchableOpacity
          style={[styles.gasAccountBtn]}
          onPress={onChangeGasAccount}>
          <Text style={styles.gasAccountTipBtnText}>
            {t('page.signFooterBar.gasAccount.deposit')}
          </Text>
        </TouchableOpacity>
      ) : null}
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
