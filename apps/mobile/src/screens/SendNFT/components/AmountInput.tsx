import React from 'react';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';

import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { Text, View } from 'react-native';

import RcPlusCC from '../icons/plus-cc.svg';
import RcMinusCC from '../icons/minus-cc.svg';
import { NumericInput } from '@/components/Form/NumbericInput';
import TouchableView from '@/components/Touchable/TouchableView';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Tip } from '@/components';
import { useTranslation } from 'react-i18next';

function CalcButton({
  disabled,
  isMinus,
  // svgProps,
  ...props
}: {
  disabled?: boolean;
  isMinus?: boolean;
  // svgProps?: Omit<SvgProps, 'color'>;
} & Omit<React.ComponentProps<typeof TouchableView>, 'ref'>) {
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

export function NFTAmountInput({
  nftItem,
  value = 0,
  onChange,
  style,
}: RNViewProps & {
  nftItem: NFTItem;
  value?: number | string;
  onChange?: (value: number) => void;
}) {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const valueNum = bizNumberUtils.coerceInteger(value);
  const handleInc = React.useCallback(() => {
    const nextVal = valueNum + 1;
    onChange?.(nextVal);
  }, [valueNum, onChange]);

  const handleDec = React.useCallback(() => {
    const nextVal = Math.max(valueNum - 1, 0);
    onChange?.(nextVal);
  }, [valueNum, onChange]);

  const { nftAmount, couldInc, couldDec } = React.useMemo(() => {
    const nftAmount = Math.max(1, nftItem?.amount || 1);
    return {
      nftAmount,
      disabledDueToSolo: nftItem?.is_erc721,
      couldInc: valueNum < nftAmount,
      couldDec: valueNum > 0,
    };
  }, [nftItem?.amount, nftItem?.is_erc721, valueNum]);

  return (
    <View style={[styles.inputAmountWrapper, style]}>
      <CalcButton
        disabled={!couldDec}
        onPress={handleDec}
        style={styles.calcBtn}
        isMinus
      />
      <NumericInput
        min={0}
        max={nftAmount}
        value={value + ''}
        onChangeText={val => {
          onChange?.(bizNumberUtils.coerceInteger(val));
        }}
        maxLength={8}
        style={styles.input}
        placeholderTextColor={styles.input.color}
      />
      <Tip
        placement="top"
        contentStyle={styles.tooltipContentStyle}
        content={
          <View style={styles.tooltipInnerStyle}>
            <Text style={styles.tipText}>
              {nftItem.is_erc1155
                ? t('component.NFTNumberInput.erc1155Tips', {
                    amount: nftItem.amount,
                  })
                : t('component.NFTNumberInput.erc721Tips')}
            </Text>
          </View>
        }>
        <CalcButton
          disabled={!couldInc}
          onPress={handleInc}
          style={styles.calcBtn}
        />
      </Tip>
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
    tooltipContentStyle: {
      borderRadius: 2,
      height: 33,
    },
    tooltipInnerStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    tipText: {
      color: colors['neutral-title2'],
      fontSize: 12,
      fontWeight: '400',
    },
  };
});
