import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, Text } from 'react-native';

export const BubbleWithText = ({ slide }: { slide: number }) => {
  const { styles } = useTheme2024({ getStyle: getBubbleStyles });

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text} numberOfLines={1}>
          {slide}%
        </Text>
      </View>
      <View style={styles.arrowWrapper}>
        <View style={styles.arrowBorder}>
          <View style={styles.arrowInner} />
        </View>
      </View>
    </View>
  );
};

const getBubbleStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexGrow: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
  },
  arrowWrapper: {
    position: 'relative',
    top: -1,
    alignItems: 'center',
  },
  arrowBorder: {
    position: 'relative',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors2024['neutral-line'],
  },
  arrowInner: {
    position: 'absolute',
    top: -13.5,
    left: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors2024['neutral-bg-2'],
  },

  tokenText: {
    color: colors2024['neutral-title-1'],
  },
  text: {
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
