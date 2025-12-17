import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const linearStyle = StyleSheet.create({
  gradient: {
    height: '100%' as const,
  },
});

const Linear = () => {
  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={linearStyle.gradient}
      colors={[
        'rgba(190,190,190,.2)',
        'rgba(129,129,129,.24)',
        'rgba(190,190,190,.2)',
      ]}
    />
  );
};

export const PerpsPositionSkeletonLoader: React.FC = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <View style={styles.positionSection}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.perpsDetail.PerpsPosition.title')}
        </Text>
      </View>
      <View style={styles.list}>
        {new Array(6).fill(0).map((_, index) => (
          <View key={index} style={styles.marketItem}>
            <View style={styles.marketItemLeft}>
              <Skeleton
                animation="wave"
                width={100}
                height={20}
                LinearGradientComponent={Linear}
                style={styles.skeleton}
              />
            </View>
            <View style={styles.marketItemRight}>
              <Skeleton
                animation="wave"
                width={80}
                height={20}
                LinearGradientComponent={Linear}
                style={styles.skeleton}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export const PerpsSkeletonLoader: React.FC = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      {/* Account Card Skeleton */}
      <View style={styles.accountCard}>
        <View style={styles.accountValueRow}>
          <Skeleton
            animation="wave"
            width={180}
            height={32}
            LinearGradientComponent={Linear}
            style={styles.skeleton}
          />
        </View>
        <Skeleton
          animation="wave"
          width={120}
          height={16}
          LinearGradientComponent={Linear}
          style={styles.skeleton}
        />
        <View style={styles.accountStatsRow}>
          <View style={styles.statItem}>
            <Skeleton
              animation="wave"
              height={48}
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          </View>
          <View style={styles.statItem}>
            <Skeleton
              animation="wave"
              height={48}
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          </View>
        </View>
      </View>

      {/* Position Section Skeleton */}
      <View style={styles.positionSection}>
        <Skeleton
          animation="wave"
          width={100}
          height={18}
          LinearGradientComponent={Linear}
          style={[styles.skeleton, styles.sectionTitle]}
        />
        <View style={styles.marketItem}>
          <View style={styles.marketItemLeft}>
            <Skeleton
              animation="wave"
              circle
              width={36}
              height={36}
              LinearGradientComponent={Linear}
              style={[styles.skeleton, styles.marketIcon]}
            />
            <View style={styles.marketItemInfo}>
              <Skeleton
                animation="wave"
                width={80}
                height={16}
                LinearGradientComponent={Linear}
                style={[styles.skeleton, styles.marketName]}
              />
              <Skeleton
                animation="wave"
                width={60}
                height={14}
                LinearGradientComponent={Linear}
                style={styles.skeleton}
              />
            </View>
          </View>
          <View style={styles.marketItemRight}>
            <Skeleton
              animation="wave"
              width={100}
              height={20}
              LinearGradientComponent={Linear}
              style={[styles.skeleton, styles.marketPrice]}
            />
            <Skeleton
              animation="wave"
              width={60}
              height={16}
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          </View>
        </View>
      </View>

      {/* Market Section Header Skeleton */}
      <View style={styles.marketHeader}>
        <Skeleton
          animation="wave"
          width={120}
          height={18}
          LinearGradientComponent={Linear}
          style={styles.skeleton}
        />
      </View>

      {/* Market Items Skeleton */}
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={styles.marketItem}>
          <View style={styles.marketItemLeft}>
            <Skeleton
              animation="wave"
              circle
              width={36}
              height={36}
              LinearGradientComponent={Linear}
              style={[styles.skeleton, styles.marketIcon]}
            />
            <View style={styles.marketItemInfo}>
              <Skeleton
                animation="wave"
                width={80}
                height={16}
                LinearGradientComponent={Linear}
                style={[styles.skeleton, styles.marketName]}
              />
              <Skeleton
                animation="wave"
                width={60}
                height={14}
                LinearGradientComponent={Linear}
                style={styles.skeleton}
              />
            </View>
          </View>
          <View style={styles.marketItemRight}>
            <Skeleton
              animation="wave"
              width={100}
              height={20}
              LinearGradientComponent={Linear}
              style={[styles.skeleton, styles.marketPrice]}
            />
            <Skeleton
              animation="wave"
              width={60}
              height={16}
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeleton: {
    backgroundColor: 'rgba(190,190,190,0.2)',
    borderRadius: 6,
  },
  accountCard: {
    backgroundColor: colors2024['neutral-card-1'],
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  accountValueRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  accountStatsRow: {
    marginTop: 24,
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    marginBottom: 8,
  },
  positionSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  marketHeader: {
    marginBottom: 6,
    paddingVertical: 8,
  },
  marketItem: {
    backgroundColor: colors2024['neutral-card-1'],
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marketItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  marketIcon: {
    borderRadius: 100,
  },
  marketItemInfo: {
    marginLeft: 12,
  },
  marketName: {
    marginBottom: 6,
  },
  marketItemRight: {
    alignItems: 'flex-end',
  },
  marketPrice: {
    marginBottom: 6,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 12,
    gap: 12,
    flexDirection: 'row',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  list: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
}));
