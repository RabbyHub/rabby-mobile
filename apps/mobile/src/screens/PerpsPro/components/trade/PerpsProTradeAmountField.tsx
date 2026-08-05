import RcIconSwitchUnit from '@/assets/icons/swap/switch-cc.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

const AmountStepIcon: React.FC<{ type: 'minus' | 'plus' }> = ({ type }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.stepIcon} testID={`perps-pro-trade-amount-${type}`}>
      <View style={styles.stepHorizontal} />
      {type === 'plus' ? <View style={styles.stepVertical} /> : null}
    </View>
  );
};

export const PerpsProTradeAmountField: React.FC<{
  label: string;
  quoteAsset: string;
}> = React.memo(({ label, quoteAsset }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.container} testID="perps-pro-trade-amount-field">
      <View style={styles.amountArea}>
        <AmountStepIcon type="minus" />
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        <AmountStepIcon type="plus" />
      </View>
      <View style={styles.unitArea} testID="perps-pro-trade-amount-unit">
        <Text numberOfLines={1} style={styles.unit}>
          {quoteAsset}
        </Text>
        <View style={styles.switchIcon}>
          <RcIconSwitchUnit
            color={colors2024['neutral-secondary']}
            height={10}
            width={10}
          />
        </View>
      </View>
    </View>
  );
});

PerpsProTradeAmountField.displayName = 'PerpsProTradeAmountField';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    flexDirection: 'row',
    height: 40,
    overflow: 'hidden',
  },
  amountArea: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: '100%',
    minWidth: 0,
    padding: 8,
  },
  stepIcon: {
    height: 12,
    overflow: 'hidden',
    position: 'relative',
    width: 12,
  },
  stepHorizontal: {
    backgroundColor: colors2024['neutral-info'],
    borderRadius: 1,
    height: 1.5,
    left: 1,
    position: 'absolute',
    top: 5.25,
    width: 10,
  },
  stepVertical: {
    backgroundColor: colors2024['neutral-info'],
    borderRadius: 1,
    height: 10,
    left: 5.25,
    position: 'absolute',
    top: 1,
    width: 1.5,
  },
  label: {
    color: colors2024['neutral-info'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    minWidth: 0,
    textAlign: 'center',
  },
  unitArea: {
    alignItems: 'center',
    borderLeftColor: colors2024['neutral-line'],
    borderLeftWidth: 1,
    flexDirection: 'row',
    gap: 2,
    height: 24,
    paddingLeft: 6,
    paddingRight: 4,
    width: 52,
  },
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    width: 34,
  },
  switchIcon: {
    height: 10,
    transform: [{ rotate: '180deg' }],
    width: 10,
  },
}));
