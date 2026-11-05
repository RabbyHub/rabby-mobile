import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

export const Empty = ({
  description,
  style,
}: {
  description: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, style]}>
      {isLight ? <RcIconEmpty /> : <RcIconEmptyDark />}
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: {
    paddingTop: 21,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-info'],
  },
}));
