import { ThemeColors2024 } from '@/constant/theme';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsOpenOrderCategory } from '../../model/openOrder';
import { PerpsProInfoControls } from '../info/PerpsProInfoControls';

type VisibleCategory = Exclude<PerpsOpenOrderCategory, 'unsupported'>;

export const PerpsProOpenOrdersControls: React.FC<{
  basicCount: number;
  category: VisibleCategory;
  conditionalCount: number;
  hideOtherSymbols: boolean;
  isCancelAllPending: boolean;
  onCancelAll: () => void;
  onSetCategory: (category: VisibleCategory) => void;
  onToggleHideOtherSymbols: () => void;
}> = React.memo(
  ({
    basicCount,
    category,
    conditionalCount,
    hideOtherSymbols,
    isCancelAllPending,
    onCancelAll,
    onSetCategory,
    onToggleHideOtherSymbols,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();

    return (
      <View>
        <PerpsProInfoControls
          actionLabel={t('page.perps.pro.openOrders.cancelAll')}
          actionDisabled={
            (category === 'basic' ? basicCount : conditionalCount) === 0
          }
          actionPending={isCancelAllPending}
          hideOtherSymbols={hideOtherSymbols}
          onAction={onCancelAll}
          onToggleHideOtherSymbols={onToggleHideOtherSymbols}
          testID="perps-pro-open-orders-controls"
        />
        <View style={styles.tabs} testID="perps-pro-open-orders-tabs">
          {(['basic', 'conditional'] as const).map(item => {
            const selected = item === category;
            const count = item === 'basic' ? basicCount : conditionalCount;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={item}
                onPress={() => onSetCategory(item)}
                style={selected ? styles.activeTab : styles.tab}
                testID={`perps-pro-open-orders-tab-${item}`}>
                <Text style={selected ? styles.activeText : styles.text}>
                  {item === 'basic'
                    ? t('page.perps.pro.openOrders.basic')
                    : t('page.perps.pro.openOrders.conditional')}
                  {'  '}
                  <Text style={selected ? styles.activeCount : styles.count}>
                    {count}
                  </Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  },
);

PerpsProOpenOrdersControls.displayName = 'PerpsProOpenOrdersControls';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  tabs: {
    flexDirection: 'row',
    gap: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  activeTab: {
    alignItems: 'center',
    backgroundColor:
      isLight === false
        ? colors2024['neutral-title-1']
        : ThemeColors2024.dark['neutral-bg-0'],
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  activeText: {
    color:
      isLight === false
        ? colors2024['neutral-bg-0']
        : ThemeColors2024.dark['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  count: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-info'],
    fontWeight: '400',
  },
  activeCount: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    color:
      isLight === false
        ? ThemeColors2024.light['neutral-foot']
        : ThemeColors2024.dark['neutral-foot'],
    fontWeight: '400',
  },
}));
