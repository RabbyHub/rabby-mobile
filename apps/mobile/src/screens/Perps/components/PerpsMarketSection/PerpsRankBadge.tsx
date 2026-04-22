import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import IconTopFirst from '@/assets2024/icons/perps/IconTopFirst.svg';
import IconTopSecond from '@/assets2024/icons/perps/IconTopSecond.svg';
import IconTopThree from '@/assets2024/icons/perps/IconTopThree.svg';

const MEDAL_ICON: Record<
  number,
  React.FC<{ width: number; height: number }>
> = {
  1: IconTopFirst,
  2: IconTopSecond,
  3: IconTopThree,
};

export const PerpsRankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const { styles } = useTheme2024({ getStyle });
  const MedalIcon = MEDAL_ICON[rank];

  if (MedalIcon) {
    return (
      <View style={styles.container}>
        <MedalIcon width={20} height={20} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.plainText}>{rank}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    width: 26,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
  },
  plainText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
