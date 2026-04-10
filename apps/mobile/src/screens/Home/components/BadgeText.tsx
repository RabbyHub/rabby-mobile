import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { StyleProp, TextStyle, View } from 'react-native';
import { Text } from '@/components/Typography';

export function BadgeText({
  count,
  style,
  isSuccess,
}: {
  count?: number;
  isSuccess?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  if (!count) {
    return null;
  }

  return (
    <View
      style={[
        styles.badgeBg,
        count > 9 && styles.badgeBgNeedPaddingHorizontal,
        style,
        isSuccess && styles.successBgColor,
      ]}>
      <Text style={[styles.badgeText]}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const BADGE_SIZE = 18;
const getStyles = createGetStyles2024(ctx => ({
  badgeBg: {
    backgroundColor: ctx.colors2024['red-default'],
    borderRadius: BADGE_SIZE,
    paddingVertical: 1,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    textAlign: 'center',
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeBgNeedPaddingHorizontal: {
    paddingHorizontal: 6,
  },
  successBgColor: {
    backgroundColor: ctx.colors2024['green-default'],
  },
  badgeText: {
    color: '#fff', // always white
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    includeFontPadding: false,
  },
}));
