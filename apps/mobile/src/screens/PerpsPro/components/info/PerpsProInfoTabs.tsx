import RcIconHistory from '@/assets2024/icons/perps/IconHistoryCC.svg';
import { Text } from '@/components/Typography';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

interface PerpsProInfoTabsProps {
  activeTab: PerpsProInfoTab;
  historyEnabled: boolean;
  openOrdersCount: number;
  onHistoryPress: () => void;
  positionsCount: number;
  onChange: (tab: PerpsProInfoTab) => void;
}

const TABS: PerpsProInfoTab[] = ['account', 'positions', 'openOrders'];

export const PerpsProInfoTabs: React.FC<PerpsProInfoTabsProps> = React.memo(
  ({
    activeTab,
    historyEnabled,
    onChange,
    onHistoryPress,
    openOrdersCount,
    positionsCount,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();

    const labels: Record<PerpsProInfoTab, string> = {
      account: t('page.perps.pro.account.account'),
      positions: `${t('page.perps.pro.account.positions')} (${positionsCount})`,
      openOrders: `${t(
        'page.perps.pro.account.openOrders',
      )} (${openOrdersCount})`,
    };

    return (
      <View accessibilityRole="tablist" style={styles.container}>
        {TABS.map(tab => {
          const selected = tab === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab}
              onPress={() => onChange(tab)}
              style={styles.tab}
              testID={`perps-pro-info-tab-${tab}`}>
              <Text
                numberOfLines={1}
                style={selected ? styles.activeText : styles.text}>
                {labels[tab]}
              </Text>
              {selected ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel={t('page.perps.pro.account.history')}
          accessibilityRole="button"
          accessibilityState={{ disabled: !historyEnabled }}
          disabled={!historyEnabled}
          onPress={onHistoryPress}
          style={styles.history}
          testID="perps-pro-history">
          <RcIconHistory
            color={
              historyEnabled
                ? colors2024['neutral-title-1']
                : colors2024['neutral-foot']
            }
            height={24}
            width={24}
          />
        </Pressable>
      </View>
    );
  },
);

PerpsProInfoTabs.displayName = 'PerpsProInfoTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    borderTopColor: colors2024['neutral-line'],
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 34,
    marginTop: 16,
    paddingHorizontal: 15,
  },
  tab: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: colors2024['neutral-title-1'],
    bottom: 0,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  history: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginLeft: 'auto',
    width: 24,
  },
}));
