import RcPrecisionCaret from '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';

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
        style={styles.strategy}>
        <Text numberOfLines={1} style={styles.strategyText}>
          {strategyLabel}
        </Text>
        <RcPrecisionCaret
          color={colors2024['neutral-secondary']}
          height={6}
          testID="perps-pro-trade-bbo-caret"
          width={8}
        />
      </Pressable>
      <Pressable
        accessibilityLabel="BBO"
        accessibilityRole="button"
        onPress={onPressToggle}
        style={styles.bbo}
        testID="perps-pro-trade-price-suffix-BBO">
        <Text style={styles.bboText}>BBO</Text>
      </Pressable>
    </View>
  );
});

PerpsProTradeBboField.displayName = 'PerpsProTradeBboField';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 40,
  },
  strategy: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  strategyText: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  bbo: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors2024['neutral-bg-5'],
    borderColor: colors2024['neutral-title-1'],
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
  },
  bboText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
}));
