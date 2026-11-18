import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const MEDAL_COLOR: Record<number, string> = {
  1: '#FFCA0A',
  2: '#E0E5EC',
  3: '#FDAD94',
};

// Medal overlaid on the bottom-right corner of the 40px logo. Top 3 only.
export const PerpsRankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const { styles } = useTheme2024({ getStyle });
  const color = MEDAL_COLOR[rank];

  if (!color) {
    return null;
  }

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{rank}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#000000',
  },
}));
