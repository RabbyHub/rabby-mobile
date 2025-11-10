import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Platform, StyleProp, Text, TextStyle, View } from 'react-native';

const isAndroid = Platform.OS === 'android';

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

  if (isAndroid) {
    return (
      <Text
        style={[
          styles.badgeBg,
          count > 9 && styles.badgeBgNeedPaddingHorizontal,
          styles.badgeText,
          style,
          isSuccess && styles.successBgColor,
        ]}>
        {count > 99 ? '99+' : count}
      </Text>
    );
  }

  // TODO: on iOS, if count >= 1000, maybe some text would be cut due to screen edge.
  return (
    <View
      style={[
        styles.badgeBg,
        count > 9 && styles.badgeBgNeedPaddingHorizontal,
        style,
        isSuccess && styles.successBgColor,
      ]}>
      <Text style={[styles.badgeText, style]}>
        {count > 99 ? '99+' : count}
      </Text>
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
    lineHeight: BADGE_SIZE + 2,
    ...Platform.select({
      ios: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
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
  },
}));
