import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import LinearGradient from 'react-native-linear-gradient';
import RcBalanceGlow from '@/assets2024/memecoin/balance-glow.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatMemeBalanceUsd } from '../ui/formatBalance';

const GRADIENT_END_LIGHT = '#FEFAED';

export const BalanceCard = ({
  totalUsd,
  loading,
}: {
  /** null when holdings could not be loaded */
  totalUsd: number | null;
  loading: boolean;
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  return (
    <View style={styles.card}>
      {/* Keep border and padding off the legacy gradient: under Fabric it
          forwards them to both its interop wrapper and its inset Paper view. */}
      <View pointerEvents="none" style={styles.background}>
        <LinearGradient
          colors={[
            colors2024['neutral-card-1'],
            isLight ? GRADIENT_END_LIGHT : colors2024['neutral-card-1'],
          ]}
          locations={[0.4, 0.98]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        {isLight ? <RcBalanceGlow style={styles.glow} /> : null}
      </View>
      {loading ? (
        <Skeleton width={140} height={36} style={styles.valueSkeleton} />
      ) : (
        <Text style={styles.value} numberOfLines={1}>
          {totalUsd === null ? '--' : formatMemeBalanceUsd(totalUsd)}
        </Text>
      )}
      <Text style={styles.pnl}>--</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    height: 120,
    // padding includes the background layer's 2px border
    paddingTop: 20,
    paddingHorizontal: 16,
    shadowColor: '#777B98',
    shadowOpacity: 0.06,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    left: -63,
    top: 30,
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  valueSkeleton: {
    borderRadius: 8,
  },
  pnl: {
    marginTop: 10,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
}));
