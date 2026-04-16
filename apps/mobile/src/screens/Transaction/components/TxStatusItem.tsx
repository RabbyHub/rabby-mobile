import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcIconFail from '@/assets2024/icons/history/IconFail.svg';
import RcIconPending from '@/assets2024/icons/history/IconPending.svg';
import RcIconSuccess from '@/assets2024/icons/history/IconSuccess.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const TxStatusItem = ({
  status,
  withText,
  isPending,
  showSuccess,
}: {
  showSuccess?: boolean;
  isPending?: boolean;
  status: number;
  withText?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  if (isPending) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Animated.View
          style={{
            transform: [{ rotate: spin }],
          }}>
          <RcIconPending width={18} height={18} />
        </Animated.View>
        {withText && (
          <Text
            style={[
              styles.statusItemText,
              { color: colors2024['orange-default'] },
            ]}>
            {t('page.transactions.detail.Pending')}
          </Text>
        )}
      </View>
    );
  }

  return status === 1 ? (
    !withText && !showSuccess ? null : (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <RcIconSuccess width={18} height={18} />
        {withText && (
          <Text style={styles.statusItemText}>
            {t('page.transactions.detail.Succeeded')}
          </Text>
        )}
      </View>
    )
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <RcIconFail width={18} height={18} />
      {withText && (
        <Text
          style={[styles.statusItemText, { color: colors2024['red-default'] }]}>
          {t('page.transactions.detail.Failed')}
        </Text>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  statusItemText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
}));
