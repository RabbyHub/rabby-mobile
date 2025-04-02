import RcIconEmpty from '@/assets2024/icons/history/ImgEmpty.svg';
import RcIconEmptyDark from '@/assets2024/icons/history/ImgEmptyDark.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View, ViewProps } from 'react-native';

export const EmptyAssets = ({
  style,
  desc = '',
}: {
  style?: ViewProps['style'];
  desc?: '';
}) => {
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.empty}>
        {isLight ? (
          <RcIconEmpty style={styles.image} />
        ) : (
          <RcIconEmptyDark style={styles.image} />
        )}
        <Text style={styles.title}>{desc}</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => ({
  container: {
    height: 186,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    marginHorizontal: 16,
  },
  empty: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 21,
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  desc: {
    color: colors['neutral-body'],
    fontSize: 14,
    lineHeight: 17,
  },
  image: {},
}));
