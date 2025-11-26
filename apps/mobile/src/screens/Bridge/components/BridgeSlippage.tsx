import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  Animated,
  StyleSheet,
} from 'react-native';
import BigNumber from 'bignumber.js';
import { Trans, useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Input } from '@rneui/base';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';
import { formatSpeicalAmount } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { WarningText } from './WarningText';

export const BRIDGE_SLIPPAGE = ['0.5', '1'];

export const SWAP_SLIPPAGE = ['1', '5'];

const BRIDGE_MAX_SLIPPAGE = 10;

const SWAP_MAX_SLIPPAGE = 50;

interface SlippageProps {
  value: string;
  displaySlippage: string;
  onChange: (n: string) => void;
  recommendValue?: number;
  autoSlippage: boolean;
  isCustomSlippage: boolean;
  setAutoSlippage: (boolean: boolean) => void;
  setIsCustomSlippage: (boolean: boolean) => void;
  type: 'swap' | 'bridge';
  isWrapToken?: boolean;
  autoSuggestSlippage?: string;
  loading?: boolean;
}

const SlippageItem = (props: TouchableOpacityProps & { active?: boolean }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      activeOpacity={1}
      {...props}
      style={[styles.item, props.active && styles.itemActive, props.style]}
    />
  );
};

export const useSlippageTooLowOrTooHigh = (params: {
  type: 'swap' | 'bridge';
  value?: string;
}) => {
  const { type, value } = params;
  const [minimumSlippage, maximumSlippage] = useMemo(() => {
    if (type === 'swap') {
      return [0.1, 10];
    }
    return [0.2, 3];
  }, [type]);

  const [isLow, isHigh] = useMemo(() => {
    return [
      value?.trim() !== '' && Number(value || 0) < minimumSlippage,
      value?.trim() !== '' && Number(value || 0) > maximumSlippage,
    ];
  }, [maximumSlippage, minimumSlippage, value]);
  return isLow || isHigh;
};

export const BridgeSlippage = (props: SlippageProps) => {
  const { t } = useTranslation();

  const { styles, colors2024 } = useTheme2024({ getStyle });

  const {
    value,
    displaySlippage,
    onChange,
    recommendValue,
    autoSlippage,
    setAutoSlippage,
    isCustomSlippage,
    setIsCustomSlippage,
    type,
    isWrapToken,
    autoSuggestSlippage,
    loading,
  } = props;
  const [slippageOpen, setSlippageOpen] = useState(false);

  const [minimumSlippage, maximumSlippage] = useMemo(() => {
    if (type === 'swap') {
      return [0.1, 10];
    }
    return [0.2, 3];
  }, [type]);

  const SLIPPAGE = useMemo(() => {
    if (type === 'swap') {
      return SWAP_SLIPPAGE;
    }
    return BRIDGE_SLIPPAGE;
  }, [type]);

  const MAX_SLIPPAGE = useMemo(() => {
    if (type === 'swap') {
      return SWAP_MAX_SLIPPAGE;
    }
    return BRIDGE_MAX_SLIPPAGE;
  }, [type]);
  const [isLow, isHigh] = useMemo(() => {
    return [
      value?.trim() !== '' && Number(value || 0) < minimumSlippage,
      value?.trim() !== '' && Number(value || 0) > maximumSlippage,
    ];
  }, [maximumSlippage, minimumSlippage, value]);

  useEffect(() => {
    if (
      !autoSlippage &&
      !isCustomSlippage &&
      SLIPPAGE.findIndex(item => item === value) === -1
    ) {
      setIsCustomSlippage(true);
    }
  }, [SLIPPAGE, autoSlippage, isCustomSlippage, setIsCustomSlippage, value]);

  const setRecommendValue = useCallback(() => {
    onChange(new BigNumber(recommendValue || 0).times(100).toString());
    setAutoSlippage(false);
    setIsCustomSlippage(false);
  }, [onChange, recommendValue, setAutoSlippage, setIsCustomSlippage]);

  const tips = useMemo(() => {
    if (isLow) {
      return t(
        'page.swap.low-slippage-may-cause-failed-transactions-due-to-high-volatility',
      );
    }
    if (isHigh) {
      return t(
        'page.swap.transaction-might-be-frontrun-because-of-high-slippage-tolerance',
      );
    }
    if (recommendValue) {
      return (
        <Trans
          i18nKey="page.swap.recommend-slippage"
          value={{
            slippage: new BigNumber(recommendValue || 0).times(100).toString(),
          }}
          t={t}>
          To prevent front-running, we recommend a slippage of{' '}
          <Text onPress={setRecommendValue}>
            {{
              //@ts-expect-error  No overload matches this call.
              slippage: new BigNumber(recommendValue || 0)
                .times(100)
                .toString(),
            }}
          </Text>
          %
        </Trans>
      );
    }

    return null;
  }, [isHigh, isLow, recommendValue, setRecommendValue, t]);

  const onInputChange = useCallback(
    (input: string) => {
      const text = formatSpeicalAmount(input);
      setAutoSlippage(false);
      setIsCustomSlippage(true);
      const v = formatSpeicalAmount(text);
      if (/^\d*(\.\d*)?$/.test(v)) {
        onChange(Number(text) > MAX_SLIPPAGE ? `${MAX_SLIPPAGE}` : text);
      }
    },
    [MAX_SLIPPAGE, onChange, setAutoSlippage, setIsCustomSlippage],
  );

  useEffect(() => {
    if (tips) {
      setSlippageOpen(true);
    }
  }, [tips]);

  if (type === 'swap' && isWrapToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{t('page.swap.slippage-tolerance')}</Text>
        <Text style={styles.wrapSlippage}>
          {t('page.swap.no-slippage-for-wrap')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setSlippageOpen(open => !open)}>
        <Text style={styles.text}>{t('page.swap.slippage-tolerance')}</Text>
        <View style={styles.valueContainer}>
          {type === 'swap' && autoSlippage && loading ? (
            <CustomSkeleton
              style={{
                width: 131,
                height: 24,
                borderRadius: 100,
              }}
            />
          ) : (
            <>
              <Text style={[styles.value, !!tips && styles.warning]}>
                {type === 'swap' && autoSlippage
                  ? autoSuggestSlippage || displaySlippage
                  : displaySlippage}
                %
              </Text>
              <Animated.View
                style={{
                  transform: [{ rotate: slippageOpen ? '180deg' : '0deg' }],
                }}>
                <RcIconBluePolygon
                  color={
                    tips
                      ? colors2024['orange-default']
                      : colors2024['brand-default']
                  }
                />
              </Animated.View>
            </>
          )}
        </View>
      </TouchableOpacity>
      {slippageOpen && (
        <View style={styles.selectContainer}>
          <View style={styles.listContainer}>
            <SlippageItem
              active={autoSlippage}
              onPress={() => {
                if (autoSlippage) {
                  return;
                }
                onChange(value);
                setAutoSlippage(true);
                setIsCustomSlippage(false);
              }}>
              <Text style={[styles.input, autoSlippage && styles.activeText]}>
                {t('page.swap.Auto')}
              </Text>
            </SlippageItem>

            {SLIPPAGE.map(e => (
              <SlippageItem
                key={e}
                active={!autoSlippage && !isCustomSlippage && e === value}
                onPress={() => {
                  setIsCustomSlippage(false);
                  setAutoSlippage(false);
                  onChange(e);
                }}>
                <Text
                  style={[
                    styles.input,
                    !autoSlippage &&
                      !isCustomSlippage &&
                      e === value &&
                      styles.activeText,
                  ]}>
                  {e}%
                </Text>
              </SlippageItem>
            ))}

            <SlippageItem
              style={[
                styles.inputItem,
                isCustomSlippage && { borderColor: colors2024['blue-default'] },
              ]}
              active={isCustomSlippage && !autoSlippage}>
              <Input
                errorStyle={styles.errorStyle}
                inputContainerStyle={styles.inputContainerStyle}
                inputStyle={styles.input}
                value={value}
                onPressIn={() => {
                  setIsCustomSlippage(true);
                  setAutoSlippage(false);
                }}
                onChangeText={onInputChange}
                placeholder="0.1"
                keyboardType="numeric"
                rightIcon={<Text style={styles.input}>%</Text>}
              />
            </SlippageItem>
          </View>
        </View>
      )}
      {!!tips && slippageOpen && <WarningText>{tips}</WarningText>}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  warning: {
    color: colors2024['orange-default'],
  },
  selectContainer: {
    marginTop: 8,
  },
  input: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  inputContainerStyle: {
    borderWidth: 0,
    borderBottomWidth: 0,
  },
  errorStyle: {
    margin: 0,
    padding: 0,
    maxHeight: 0,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    backgroundColor: colors2024['neutral-bg-2'],
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    width: 68,
    borderRadius: 6,
  },
  itemActive: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inputItem: {
    flex: 1,
    borderColor: colors2024['neutral-line'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  wrapSlippage: {
    color: colors2024['neutral-foot'],
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  activeText: {
    color: colors2024['brand-default'],
  },
}));
