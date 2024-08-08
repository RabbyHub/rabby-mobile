import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { Trans, useTranslation } from 'react-i18next';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { getTokenSymbol } from '@/utils/token';
import { formatTokenAmount } from '@/utils/number';
import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

const getStyles = createGetStyles(colors => {
  return {
    gasReservedView: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      // ...makeDebugBorder()
    },
    gasReservedText: {
      fontWeight: '400',
      fontSize: 12,
      lineHeight: 14,
      textAlign: 'right',
      color: colors['neutral-foot'],
    },
    // tokenAmount: {
    //   marginVertical: 0,
    //   marginHorizontal: 2
    // },
    tokenAmountText: {
      color: colors['blue-default'],
      textDecorationLine: 'underline',
      fontWeight: '500',
    },
  };
});

interface GasReservedProps {
  amount: string;
  token: TokenItem;
  onClickAmount(): void;
  trigger?: 'number' | 'whole';
}

/**
 * @deprecated
 */
export default function GasReserved({
  amount,
  token,
  onClickAmount,
  trigger = 'number',
  style,
}: RNViewProps & GasReservedProps) {
  const { t } = useTranslation();

  const tokenName = useMemo(() => {
    return getTokenSymbol(token);
  }, [token]);

  const { styles } = useThemeStyles(getStyles);

  const triggerOnNumber = trigger === 'number';

  return (
    <TouchableView
      disabled={triggerOnNumber}
      style={[styles.gasReservedView, style]}
      onPress={onClickAmount}>
      <Text
        style={styles.gasReservedText}
        ellipsizeMode="tail"
        numberOfLines={1}>
        <Trans
          i18nKey="page.sendTokenComponents.GasReserved"
          values={{
            tokenName: getTokenSymbol(token),
          }}
          t={t}>
          Reserved
          <Text
            style={styles.tokenAmountText}
            disabled={!triggerOnNumber}
            onPress={() => {
              if (!triggerOnNumber) return;
              onClickAmount();
            }}>
            {' '}
            {formatTokenAmount(amount, 4)}{' '}
          </Text>
          {tokenName} for gas cost
        </Trans>
      </Text>
    </TouchableView>
  );
}
