import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

export const PerpsProAccountSkeleton: React.FC = React.memo(() => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('page.perps.pro.account.disabledFrame')}
      accessibilityState={{ disabled: true }}
      style={styles.container}>
      <View style={styles.tabs}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText}>
            {t('page.perps.pro.account.account')}
          </Text>
          <View style={styles.activeIndicator} />
        </View>
        <Text style={styles.tabText}>
          {t('page.perps.pro.account.positions')}
        </Text>
        <Text style={styles.tabText}>
          {t('page.perps.pro.account.openOrders')}
        </Text>
      </View>
      <View style={styles.card}>
        <View style={styles.summary}>
          <View>
            <Text style={styles.label}>
              {t('page.perps.pro.account.totalValue')}
            </Text>
            <Text style={styles.value}>-</Text>
          </View>
          <View style={styles.rightSummary}>
            <Text style={styles.label}>
              {t('page.perps.pro.account.unrealizedPnl')}
            </Text>
            <Text style={styles.value}>-</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Text style={styles.actionText}>
              {t('page.perps.pro.account.deposit')}
            </Text>
          </View>
          <View style={styles.action}>
            <Text style={styles.actionText}>
              {t('page.perps.pro.account.withdraw')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

PerpsProAccountSkeleton.displayName = 'PerpsProAccountSkeleton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginTop: 16,
    paddingBottom: 32,
  },
  tabs: {
    alignItems: 'center',
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 34,
    paddingHorizontal: 16,
  },
  activeTab: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 8,
    position: 'relative',
  },
  activeTabText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  activeIndicator: {
    backgroundColor: colors2024['neutral-title-1'],
    bottom: 0,
    height: 2,
    left: 8,
    position: 'absolute',
    right: 8,
  },
  tabText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-bg-5'],
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rightSummary: {
    alignItems: 'flex-end',
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  value: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 8,
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  actionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
