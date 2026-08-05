import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProHistoryTab } from '../types';

const TABS: PerpsProHistoryTab[] = [
  'orders',
  'trade',
  'transaction',
  'funding',
];

export const PerpsProHistoryTabs: React.FC<{
  activeTab: PerpsProHistoryTab;
  onChange: (tab: PerpsProHistoryTab) => void;
}> = React.memo(({ activeTab, onChange }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map(tab => {
          const selected = activeTab === tab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab}
              onPress={() => onChange(tab)}
              style={styles.tab}
              testID={`perps-pro-history-tab-${tab}`}>
              <Text style={selected ? styles.activeText : styles.text}>
                {t(`page.perps.pro.history.tabs.${tab}`)}
              </Text>
              {selected ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
});

PerpsProHistoryTabs.displayName = 'PerpsProHistoryTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  scroll: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  content: {
    minWidth: '100%',
    paddingHorizontal: 16,
  },
  tabs: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 24,
    height: 48,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
    position: 'relative',
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: colors2024['blue-default'],
    bottom: 0,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
}));
