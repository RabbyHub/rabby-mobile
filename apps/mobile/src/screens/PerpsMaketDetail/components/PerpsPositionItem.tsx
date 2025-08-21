import { RcIconLong } from '@/assets2024/icons/perps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const PerpsPositionItem: React.FC<{}> = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <View style={styles.icon} />
        <RcIconLong
          style={styles.directionIcon}
          bgColor={colors2024['neutral-bg-1']}
          color={colors2024['neutral-title-1']}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.name}>BTC-USD</Text>
          <Text style={styles.price}>$114,539.00</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.leverage}>Short 10x</Text>
          <Text style={[styles.priceChange, styles.priceChangeDown]}>
            +$24.32 (+0.87%)
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  directionIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 1000,
    backgroundColor: 'red',
  },
  content: {
    flex: 1,

    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  leverage: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  priceChange: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['green-default'],
  },
  priceChangeDown: {
    color: colors2024['red-default'],
  },
}));
