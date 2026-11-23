import { ThemeColors2024 } from '@/constant/theme';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsOpenOrderCategory } from '../../model/openOrder';
import { PerpsProInfoControls } from '../info/PerpsProInfoControls';
import {
  PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT,
  PERPS_PRO_OPEN_ORDERS_CATEGORY_HEIGHT,
  PERPS_PRO_OPEN_ORDERS_CONTROLS_BOTTOM,
  PERPS_PRO_OPEN_ORDERS_CONTROLS_ROW_GAP,
  PERPS_PRO_OPEN_ORDERS_CONTROLS_TOP,
} from '../info/perpsProInfoTabsSticky';

type VisibleCategory = Exclude<PerpsOpenOrderCategory, 'unsupported'> | 'twap';

export const PerpsProOpenOrdersControls: React.FC<{
  twapCount?: number;
  onAddTwap?: () => void;
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
    twapCount = 0,
    onAddTwap,
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
          actionLabel={t(
            category === 'twap'
              ? 'page.perps.pro.twap.add'
              : 'page.perps.pro.openOrders.cancelAll',
          )}
          actionDisabled={
            category !== 'twap' &&
            (category === 'basic' ? basicCount : conditionalCount) === 0
          }
          actionPending={category !== 'twap' && isCancelAllPending}
          hideOtherSymbols={hideOtherSymbols}
          onAction={category === 'twap' ? onAddTwap ?? (() => {}) : onCancelAll}
          onToggleHideOtherSymbols={onToggleHideOtherSymbols}
          style={styles.controls}
          testID="perps-pro-open-orders-controls"
        />
        <View style={styles.tabs} testID="perps-pro-open-orders-tabs">
          {(['basic', 'conditional', 'twap'] as const).map(item => {
            const selected = item === category;
            const count =
              item === 'twap'
                ? twapCount
                : item === 'basic'
                ? basicCount
                : conditionalCount;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={item}
                onPress={() => onSetCategory(item)}
                style={selected ? styles.activeTab : styles.tab}
                testID={`perps-pro-open-orders-tab-${item}`}>
                <Text style={selected ? styles.activeText : styles.text}>
                  {item === 'twap'
                    ? 'TWAP'
                    : item === 'basic'
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
  // Image review spacing: 8pt below the tab divider, 4pt to the chips and
  // 8pt to the first card.
  controls: {
    height:
      PERPS_PRO_OPEN_ORDERS_CONTROLS_TOP +
      PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT +
      PERPS_PRO_OPEN_ORDERS_CONTROLS_ROW_GAP,
    paddingBottom: PERPS_PRO_OPEN_ORDERS_CONTROLS_ROW_GAP,
    paddingTop: PERPS_PRO_OPEN_ORDERS_CONTROLS_TOP,
  },
  tabs: {
    flexDirection: 'row',
    gap: 0,
    height:
      PERPS_PRO_OPEN_ORDERS_CATEGORY_HEIGHT +
      PERPS_PRO_OPEN_ORDERS_CONTROLS_BOTTOM,
    paddingHorizontal: 12,
    paddingBottom: PERPS_PRO_OPEN_ORDERS_CONTROLS_BOTTOM,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 8,
    borderCurve: 'continuous',
    height: PERPS_PRO_OPEN_ORDERS_CATEGORY_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  activeTab: {
    alignItems: 'center',
    backgroundColor:
      isLight === false
        ? colors2024['neutral-bg-2']
        : ThemeColors2024.dark['neutral-bg-0'],
    borderRadius: 8,
    borderCurve: 'continuous',
    height: PERPS_PRO_OPEN_ORDERS_CATEGORY_HEIGHT,
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
    // Dark keeps the Light selected copy on the bg-2 chip (Figma 87900:97310).
    color: ThemeColors2024.dark['neutral-title-1'],
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
    color: ThemeColors2024.dark['neutral-foot'],
    fontWeight: '400',
  },
}));
