import PerpsProHistoryEmptyImage from '@/assets2024/icons/perps/PerpsProHistoryEmpty.png';
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { PERPS_PRO_FONT_FAMILY } from '@/screens/PerpsPro/components/common/perpsProVisual';
import { createGetStyles2024 } from '@/utils/styles';

export const PerpsProHistorySkeleton = () => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View accessibilityLabel="Loading history" style={styles.skeletonList}>
      {[0, 1, 2, 3, 4].map(index => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonBadge} />
          </View>
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonLineShort} />
        </View>
      ))}
    </View>
  );
};

export const PerpsProHistoryEmpty = () => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={styles.empty} testID="perps-pro-history-empty">
      <Image
        source={PerpsProHistoryEmptyImage}
        style={styles.emptyImage}
        testID="perps-pro-history-empty-illustration"
      />
      <Text style={styles.emptyMessage}>
        {t('page.perps.pro.history.noHistory')}
      </Text>
    </View>
  );
};

export const PerpsProHistoryError: React.FC<{ onRetry: () => void }> = ({
  onRetry,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.message}>
        {t('page.perps.pro.history.loadFailed')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryButton,
          pressed && styles.buttonPressed,
        ]}>
        <Text style={styles.retryText}>{t('page.perps.pro.common.retry')}</Text>
      </Pressable>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  skeletonList: {
    flex: 1,
    gap: 8,
  },
  skeletonRow: {
    backgroundColor: colors2024['neutral-card-1'],
    borderRadius: 12,
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonTitle: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 4,
    height: 20,
    width: 112,
  },
  skeletonBadge: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 4,
    height: 20,
    width: 64,
  },
  skeletonLine: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 3,
    height: 14,
    width: '100%',
  },
  skeletonLineShort: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 3,
    height: 14,
    width: '72%',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: 32,
  },
  message: {
    color: colors2024['neutral-secondary'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  retryText: {
    color: colors2024['blue-default'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    paddingTop: 188,
  },
  emptyImage: {
    height: 126,
    width: 163,
  },
  emptyMessage: {
    color: colors2024['neutral-info'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
}));
