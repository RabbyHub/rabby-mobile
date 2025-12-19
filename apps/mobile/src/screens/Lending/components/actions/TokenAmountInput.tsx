import React, { useCallback, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { Text, TouchableOpacity, View } from 'react-native';
import { SilentTouchableView } from '@/components/Touchable/TouchableView';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatSpeicalAmount, splitNumberByStep } from '@/utils/number';
import { NumericInput } from '@/components/Form/NumbericInput';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import LinearGradient from 'react-native-linear-gradient';
import TokenIcon from '../TokenIcon';
import { CHAINS_ENUM } from '@debank/common';

interface TokenAmountInputProps {
  symbol: string;
  value?: string;
  tokenAmount: number;
  price?: number;
  chain: CHAINS_ENUM;
  onChange?(amount: string): void;
  handleClickMaxButton?: () => Promise<void> | void;
  inlinePrize?: boolean;
  className?: string;
  placeholder?: string;
  isEstimatingGas?: boolean;
}

export const TokenAmountInput = ({
  symbol,
  value,
  price = 1,
  tokenAmount,
  onChange,
  chain,
  inlinePrize,
  style,
  handleClickMaxButton,
  isEstimatingGas,
}: React.PropsWithChildren<RNViewProps & TokenAmountInputProps>) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { valueText } = useMemo(() => {
    const num = Number(value);

    const _valueText = num
      ? `$${splitNumberByStep(((num || 0) * price || 0).toFixed(2))}`
      : '$0';

    return {
      valueNum: num,
      valueText: _valueText,
    };
  }, [value, price]);

  const Linear = useCallback(() => {
    return (
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ height: '100%' }}
        colors={[colors2024['neutral-line'], colors2024['neutral-bg-2']]}
      />
    );
  }, [colors2024]);

  const handleChangeText = useMemo(
    () =>
      debounce((v: string) => {
        onChange?.(formatSpeicalAmount(v));
      }, 200),
    [onChange],
  );

  useEffect(() => {
    return () => {
      handleChangeText.cancel();
    };
  }, [handleChangeText]);

  return (
    <>
      <View style={[styles.container, style]}>
        <SilentTouchableView
          viewStyle={[
            styles.leftInputContainer,
            inlinePrize && !!valueText && styles.containerHasInlinePrize,
          ]}
          onPress={evt => {
            evt.stopPropagation();
          }}>
          {!value && tokenAmount > 0 && isEstimatingGas ? (
            <CustomSkeleton
              animation="wave"
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          ) : (
            <NumericInput
              style={[
                inlinePrize && !!valueText && styles.inputHasInlinePrize,
                styles.input,
              ]}
              value={value}
              onChangeText={handleChangeText}
              max={tokenAmount}
              placeholder="0"
              placeholderTextColor={colors2024['neutral-info']}
              inputMode="decimal"
              keyboardType="numeric"
              numberOfLines={1}
            />
          )}
          <View style={styles.inlinePrizeContainer}>
            <Text
              style={styles.inlinePrizeText}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {valueText}
            </Text>
          </View>
        </SilentTouchableView>
        {/* max button */}
        {!value &&
          tokenAmount > 0 &&
          (isEstimatingGas ? null : (
            <TouchableOpacity
              disabled={isEstimatingGas}
              style={styles.maxButtonWrapper}
              onPress={handleClickMaxButton}>
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>
          ))}
        <View style={styles.placeholder} />
        <View style={styles.tokenInfoContainer}>
          <TokenIcon
            size={26}
            chainSize={12}
            tokenSymbol={symbol}
            chain={chain}
          />
          <Text style={styles.tokenSymbol}>{symbol}</Text>
        </View>
      </View>
    </>
  );
};

const PADDING = 12;

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      height: 98,
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 20,
    },

    placeholder: {
      height: 28,
      width: 1,
      backgroundColor: colors2024['neutral-line'],
      marginHorizontal: 12,
    },

    rightToken: {},
    rightInner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 4,
      backgroundColor: colors2024['neutral-line'],
      borderRadius: 12,
    },
    rightTokenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rightArrow: {
      marginLeft: 2,
    },
    rightTokenSymbol: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
    },

    leftInputContainer: {
      flex: 1,
      paddingLeft: PADDING,
      paddingVertical: 20,
      // ...makeDebugBorder('red'),
    },
    containerHasInlinePrize: {},
    input: {
      fontSize: 28,
      fontWeight: '700',
      position: 'relative',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      marginLeft: 8,
      flex: 1,
      paddingTop: 0,
      paddingBottom: 0,
    },
    inputHasInlinePrize: {
      // ...makeDebugBorder(),
    },
    inlinePrizeContainer: {
      height: 18,
      marginLeft: 8,
      // ...makeDebugBorder(),
    },
    // 'text-r-neutral-foot text-12 text-right max-w-full truncate'
    inlinePrizeText: {
      color: colors2024['neutral-info'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    maxButtonWrapper: {
      marginLeft: 12,
      padding: 4,
      backgroundColor: colors2024['brand-light-1'],
      borderRadius: 8,
    },
    maxButtonText: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    maxButtonLoading: { width: 30, height: '100%', marginLeft: 2 },
    skeleton: {
      marginTop: 16,
      marginBottom: 10,
      backgroundColor: colors2024['neutral-line'],
      height: 36,
      width: 120,
      borderRadius: 100,
    },
    tokenInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tokenSymbol: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});
