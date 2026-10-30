import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import RcBalanceCloud from '@/assets2024/memecoin/balance-cloud.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';

const GRADIENT_END_LIGHT = '#FEFAED';

export const BalanceCard = ({
  totalUsd,
  loading,
}: {
  /** null when holdings could not be loaded */
  totalUsd: number | null;
  loading: boolean;
}) => {
  const { t } = useTranslation();
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
      </View>
      {isLight ? (
        <RcBalanceCloud width={76} height={32} style={styles.cloud} />
      ) : null}
      <Text style={styles.label}>{t('page.memeCoin.balance')}</Text>
      {loading ? (
        <Skeleton width={140} height={36} style={styles.valueSkeleton} />
      ) : (
        <Text style={styles.value} numberOfLines={1}>
          {totalUsd === null ? '--' : formatUsdValue(totalUsd)}
        </Text>
      )}
      <Text style={styles.pnl}>--</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    height: 140,
    // padding includes the background layer's 2px border
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    left: 10,
    top: 12,
    transform: [{ scaleX: -1 }],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  value: {
    marginTop: 20,
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  valueSkeleton: {
    marginTop: 20,
    borderRadius: 8,
  },
  pnl: {
    marginTop: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
}));
