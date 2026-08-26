import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import { resolvePerpsProFieldBackground } from '../common/perpsProVisual';
import { getPerpsProTradeSelectFontStyle } from './PerpsProTradePrimitives';

const strategyFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);

export const PerpsProTradeBboField: React.FC<{
  onPressStrategy: () => void;
  onPressToggle: () => void;
  strategyLabel: string;
}> = React.memo(({ onPressStrategy, onPressToggle, strategyLabel }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.container} testID="perps-pro-trade-bbo-field">
      <Pressable
        accessibilityLabel={strategyLabel}
        accessibilityRole="button"
        onPress={onPressStrategy}
        style={styles.strategy}
        testID="perps-pro-trade-bbo-strategy">
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[styles.strategyText, strategyFontStyle]}
          testID="perps-pro-trade-bbo-strategy-label">
          {strategyLabel}
        </Text>
        <PerpsProSelectCaret
          color={colors2024['neutral-secondary']}
          testID="perps-pro-trade-bbo-caret"
        />
      </Pressable>
      <Pressable
        accessibilityLabel="BBO"
        accessibilityRole="button"
        onPress={onPressToggle}
        style={styles.bbo}
        testID="perps-pro-trade-price-suffix-BBO">
        <Text numberOfLines={1} style={[styles.bboText, strategyFontStyle]}>
          BBO
        </Text>
      </Pressable>
    </View>
  );
});

PerpsProTradeBboField.displayName = 'PerpsProTradeBboField';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 40,
  },
  strategy: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-5'],
      isLight,
    }),
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  strategyText: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    minWidth: 0,
    textAlign: 'center',
  },
  bbo: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-5'],
      isLight,
    }),
    borderColor: colors2024['neutral-title-1'],
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
  },
  bboText: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    width: 40,
  },
}));
