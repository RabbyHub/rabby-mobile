import { useTheme2024 } from '@/hooks/theme';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { BuyTokenSelect } from './SelectBuyToken';
import { Skeleton } from '@rneui/themed';
import LinearGradient from 'react-native-linear-gradient';
import { SelectCurrency, TCurrencyList } from './SelectCurrency';

export const BuyToken = ({
  type,
  value,
  onInputChange,
  currency = 'USD',
  onSelectCurrency,
  currencyList,
  token,
  onTokenSelect,
  noQuote,
  loading,
}: {
  type: 'from' | 'to';
  // from props
  value?: string;
  onInputChange?: (v: string) => void;
  currency?: string;
  onSelectCurrency?: (v: string) => void;
  currencyList?: TCurrencyList;

  // to props
  token?: TokenItem;
  loading?: boolean;
  onTokenSelect?: (token: TokenItem) => void;
  noQuote?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const isFiat = type === 'from';
  const isReceive = type === 'to';

  const inputRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    if (isFiat) {
      inputRef?.current?.focus();
    }
  }, [isFiat]);

  const displayValue = useMemo(() => {
    if (isReceive && value) {
      return formatTokenAmount(value, 6);
    }
    if (isFiat && value) {
      return value;
    }
    return value;
  }, [isFiat, isReceive, value]);

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

  return (
    <View style={styles.tokenBox}>
      <Text style={styles.label}>
        {isFiat ? t('page.buy.youWillPay') : t('page.buy.youWillReceive')}
      </Text>
      <View style={styles.interfaceBox}>
        {loading ? (
          <Skeleton
            animation="wave"
            width={120}
            height={24}
            LinearGradientComponent={Linear}
            style={styles.skeleton}
          />
        ) : (
          <TextInput
            numberOfLines={1}
            multiline={false}
            textAlign="left"
            keyboardType="numeric"
            inputMode="decimal"
            placeholderTextColor={colors2024['neutral-info']}
            style={styles.input}
            placeholder={
              isFiat ? '0' : noQuote ? t('page.buy.noQuotePlaceholder') : '0'
            }
            scrollEnabled={true}
            value={displayValue}
            onChangeText={e => {
              onInputChange?.(e.replaceAll('$', ''));
            }}
            focusable={isFiat}
            ref={inputRef}
            editable={isFiat}
          />
        )}
        <View style={styles.divider} />

        {isFiat && (
          <SelectCurrency
            value={currency}
            list={currencyList || []}
            onSelect={onSelectCurrency}
          />
        )}

        {isReceive && onTokenSelect ? (
          <BuyTokenSelect onTokenChange={onTokenSelect} token={token} />
        ) : null}
      </View>

      {isReceive &&
        (loading ? (
          <Skeleton
            animation="wave"
            width={40}
            height={16}
            LinearGradientComponent={Linear}
            style={styles.skeleton}
          />
        ) : (
          <Text style={[styles.usdValue, !!value && styles.usdValueBold]}>
            {formatUsdValue(
              new BigNumber(value || 0).times(token?.price || 0).toString(10),
            )}
          </Text>
        ))}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 24,
    borderRadius: 20,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },

  interfaceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 36,
    alignItems: 'center',
  },

  input: {
    flex: 1,
    paddingVertical: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
    justifyContent: 'center',
    color: colors2024['neutral-title-1'],
    fontSize: 28,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    // height: 36,
    lineHeight: 36,
    paddingLeft: 0,
    borderWidth: 0,
    overflow: 'hidden',
    padding: 0,
  },

  divider: {
    marginHorizontal: 12,
    borderWidth: 0,
    borderLeftWidth: 1,
    width: 0,
    height: 27,
    borderColor: colors2024['neutral-line'],
  },

  token: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
  },
  tokenText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  usdValue: {
    marginTop: 8,
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },
  usdValueBold: {
    fontWeight: '700',
  },
  toastText: {
    color: colors2024['neutral-title2'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    fontStyle: 'normal',
    fontWeight: '700',
  },
  skeleton: {
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 100,
  },
}));
