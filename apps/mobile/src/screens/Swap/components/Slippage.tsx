import React, { useCallback, useMemo, useState } from 'react';
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
import { useThemeColors } from '@/hooks/theme';
import useToggle from 'react-use/lib/useToggle';
import { createGetStyles } from '@/utils/styles';
import { Input } from '@rneui/base';
import { RcIconArrowUp } from '@/assets/icons/swap';

const SLIPPAGE = ['0.1', '0.3', '0.5'];

interface SlippageProps {
  value: string;
  displaySlippage: string;
  onChange: (n: string) => void;
  recommendValue?: number;
}

const SlippageItem = (props: TouchableOpacityProps & { active?: boolean }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      {...props}
      style={[styles.item, props.active && styles.itemActive, props.style]}
    />
  );
};

export const Slippage = (props: SlippageProps) => {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [isCustom, setIsCustom] = useToggle(false);

  const { value, displaySlippage, onChange, recommendValue } = props;
  const [slippageOpen, setSlippageOpen] = useState(false);

  const [isLow, isHigh] = useMemo(() => {
    return [
      value?.trim() !== '' && Number(value || 0) < 0.1,
      value?.trim() !== '' && Number(value || 0) > 10,
    ];
  }, [value]);

  const setRecommendValue = useCallback(() => {
    onChange(new BigNumber(recommendValue || 0.123).times(100).toString());
  }, [onChange, recommendValue]);

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
          <Text onPress={setRecommendValue} className="underline">
            {{
              //@ts-expect-error  No overload matches this call.
              slippage: new BigNumber(recommendValue || 0.123123)
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
    (text: string) => {
      if (/^\d*(\.\d*)?$/.test(text)) {
        onChange(Number(text) > 50 ? '50' : text);
      }
    },
    [onChange],
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setSlippageOpen(open => !open)}>
        <Text style={styles.text}>{t('page.swap.slippage-tolerance')}</Text>
        <View style={styles.valueContainer}>
          <Text style={[styles.value, !!tips && styles.warning]}>
            {displaySlippage}%
          </Text>
          <Animated.View
            style={{
              transform: [{ rotate: slippageOpen ? '180deg' : '0deg' }],
            }}>
            <RcIconArrowUp width={14} height={14} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      {slippageOpen && (
        <View style={styles.selectContainer}>
          <View style={styles.listContainer}>
            {SLIPPAGE.map(e => (
              <SlippageItem
                key={e}
                active={!isCustom && e === value}
                onPress={() => {
                  setIsCustom(false);
                  onChange(e);
                }}>
                <Text style={styles.input}>{e}%</Text>
              </SlippageItem>
            ))}
            <SlippageItem
              style={[
                styles.inputItem,
                isCustom && { borderColor: colors['blue-default'] },
              ]}
              active={isCustom}>
              <Input
                errorStyle={styles.errorStyle}
                inputContainerStyle={styles.inputContainerStyle}
                inputStyle={styles.input}
                value={value}
                onPressIn={() => setIsCustom(true)}
                onChangeText={onInputChange}
                placeholder="0.1"
                keyboardType="numeric"
                rightIcon={<Text style={styles.input}>%</Text>}
              />
            </SlippageItem>
          </View>
          {!!tips && <Text style={styles.warningTip}>{tips}</Text>}
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    color: colors['neutral-body'],
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  warning: {
    color: colors['orange-default'],
  },
  selectContainer: {
    marginTop: 8,
  },
  input: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-title-1'],
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
  warningTip: {
    padding: 10,
    color: colors['orange-default'],
    fontWeight: '400',
    fontSize: 12,
    borderRadius: 4,
    backgroundColor: colors['orange-light'], // 'rgba(255, 176, 32, 0.1)',
    marginTop: 8,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: colors['neutral-card-2'],
    justifyContent: 'center',
    alignItems: 'center',
    height: 36,
    width: 52,
    borderRadius: 4,
  },
  itemActive: {
    backgroundColor: colors['blue-light-1'],
    borderColor: colors['blue-default'],
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
    borderColor: colors['neutral-line'],
    borderWidth: StyleSheet.hairlineWidth,
  },
}));
