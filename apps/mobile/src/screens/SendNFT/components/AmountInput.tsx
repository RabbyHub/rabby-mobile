import React from 'react';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';

import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { StyleSheet, Text, View } from 'react-native';

import RcPlusCC from '../icons/plus-cc.svg';
import RcMinusCC from '../icons/minus-cc.svg';
import { NumericInput } from '@/components/Form/NumbericInput';
import TouchableView from '@/components/Touchable/TouchableView';

function CalcButton({
  disabled,
  isMinus,
  // svgProps,
  ...props
}: {
  disabled?: boolean;
  isMinus?: boolean;
  // svgProps?: Omit<SvgProps, 'color'>;
} & React.ComponentProps<typeof TouchableView>) {
  const IconCom = isMinus ? RcMinusCC : RcPlusCC;

  const colors = useThemeColors();

  return (
    <TouchableView {...props} disabled={disabled}>
      <IconCom
        // {...svgProps}
        color={disabled ? colors['neutral-line'] : colors['neutral-title1']}
      />
    </TouchableView>
  );
}

const CALC = {
  min: 0,
  max: Infinity,
};
export function NFTAmountInput({
  value = 0,
  onChange,
  style,
}: RNViewProps & {
  value?: number | string;
  onChange?: (value: number) => void;
}) {
  const { styles } = useThemeStyles(getStyles);
  const valueNum = bizNumberUtils.coerceInteger(value);
  const handleInc = React.useCallback(() => {
    const nextVal = valueNum + 1;
    onChange?.(nextVal);
  }, [valueNum, onChange]);

  const handleDec = React.useCallback(() => {
    const nextVal = Math.max(valueNum - 1, CALC.min);
    onChange?.(nextVal);
  }, [valueNum, onChange]);

  const { couldInc, couldDec } = React.useMemo(() => {
    return {
      couldInc: valueNum < CALC.max,
      couldDec: valueNum > CALC.min,
    };
  }, [valueNum]);

  return (
    <View style={[styles.inputAmountWrapper, style]}>
      <CalcButton
        disabled={!couldDec}
        onPress={handleDec}
        style={styles.calcBtn}
        isMinus
      />
      <NumericInput
        min={CALC.min}
        max={CALC.max}
        value={value + ''}
        onChangeText={val => {
          onChange?.(bizNumberUtils.coerceInteger(val));
        }}
        maxLength={8}
        style={styles.input}
        placeholderTextColor={styles.input.color}
      />
      <CalcButton
        disabled={!couldInc}
        onPress={handleInc}
        style={styles.calcBtn}
      />
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    inputAmountWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: 100,
      height: 32,
    },
    calcBtn: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      // ...makeDebugBorder('yellow'),
    },
    input: {
      height: '100%',
      padding: 2,
      textAlign: 'center',
      color: colors['neutral-title1'],
      // ...makeDebugBorder('red'),
    },
  };
});
