import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Dimensions, Text, View } from 'react-native';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
  },
}));

export const Cell: React.FC<any> = ({ children }) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  return <View style={styles.root}>{children}</View>;
};

export const CellText: React.FC<any> = ({ children }) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.text}>
      {children}
    </Text>
  );
};

const { width: windowWidth } = Dimensions.get('window');

export const CELL_WIDTH = {
  ASSET: (84 / 393) * windowWidth,
  REVOKE_FROM: (132 / 393) * windowWidth,
  GAS_FEE: (81 / 393) * windowWidth,
};
