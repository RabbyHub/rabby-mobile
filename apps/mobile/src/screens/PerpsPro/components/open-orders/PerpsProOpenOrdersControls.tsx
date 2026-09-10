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
                    : t('page.perps.pro.openOrders.conditional')}{' '}
                  ({count})
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 6,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  activeTab: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 6,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  text: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  activeText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
}));
