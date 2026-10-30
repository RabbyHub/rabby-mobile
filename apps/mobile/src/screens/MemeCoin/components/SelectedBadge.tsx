import React from 'react';
import { View } from 'react-native';
import RcIconCheck from '@/assets2024/memecoin/check.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

/**
 * Sits on the outer bottom-right corner of a card with a 2px border, above the
 * border. The card must not clip (no overflow hidden): iOS then draws the
 * border over its children and cuts the badge with the card's corner.
 */
export const SelectedBadge = () => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.badge}>
      <RcIconCheck width={9.5} height={7.5} />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderTopLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-default'],
  },
}));
