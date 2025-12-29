import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { QuoteProvider } from '../hooks';
import { useTranslation } from 'react-i18next';
import React, { useCallback, useMemo, useRef } from 'react';
import { tokenAmountBn } from '../utils';
import {
  formatSpeicalAmount,
  formatTokenAmount,
  formatUsdValue,
} from '@/utils/number';
import BigNumber from 'bignumber.js';
import { Divider, Slider } from '@rneui/themed';

import TokenSelect, { TokenSelectInst } from './TokenSelect';
import SwapToTokenSelect from './SwapToTokenSelect';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import RcIconWalletCC from '@/assets2024/icons/swap/wallet-cc.svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { BubbleWithText } from './Slider';
import { IS_ANDROID } from '@/core/native/utils';
import { Account } from '@/core/services/preference';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import usePrevious from 'react-use/lib/usePrevious';
import { ITokenItem } from '@/store/tokens';

interface SwapTokenItemProps {
  type: 'from' | 'to';
  token?: TokenItem;
  value: string;
  account?: Account | null;
  chainId: string;
  onTokenChange: (token: TokenItem) => void;
  onValueChange?: (s: string) => void;
  label?: React.ReactNode;
  slider?: number;
  onChangeSlider?: (value: number, syncAmount?: boolean) => void;
  excludeTokens?: string[];
  inSufficient?: boolean;
  valueLoading?: boolean;
  currentQuote?: QuoteProvider;
  finishedQuotes?: number;
  skeletonLoading?: boolean;
  disabled?: boolean;
}
export const SwapTokenItem = (props: SwapTokenItemProps) => {
  const {
    type,
    token,
    value,
    onTokenChange,
    onValueChange,
    excludeTokens,
    account,
    chainId,
    slider,
    onChangeSlider,
    inSufficient,
    valueLoading,
    currentQuote,
    skeletonLoading,
    disabled,
  } = props;
  const { t } = useTranslation();

  const { colors2024, styles } = useTheme2024({ getStyle });

  const isFrom = type === 'from';

  const openTokenModalRef = useRef<TokenSelectInst>(null);

  const handleTokenModalOpen = useCallback(() => {
    if (!valueLoading && !currentQuote && !isFrom) {
      openTokenModalRef?.current?.openTokenModal?.({ account });
    }
  }, [currentQuote, isFrom, valueLoading, account]);

  const [balance, usdValue] = useMemo(() => {
    if (token) {
      const amount = tokenAmountBn(token);
      return [
        formatTokenAmount(amount.toString(10)),

        formatUsdValue(
          new BigNumber(value || 0).times(token?.price).toString(10),
        ),
      ];
    }
    return [0, formatUsdValue(0)];
  }, [token, value]);

  const onTokenSelect = useCallback(
    (newToken: TokenItem) => {
      onTokenChange(newToken);
      if (isFrom && newToken.id !== token?.id) {
        onValueChange?.('');
      }
    },
    [isFrom, onTokenChange, onValueChange, token?.id],
  );

  const onInputChange: (text: string) => void = useCallback(
    e => {
      onValueChange?.(formatSpeicalAmount(e));
    },
    [onValueChange],
  );

  const showBubble = useSharedValue(false);

  const { width } = useWindowDimensions();

  const sliderStyle = useAnimatedStyle(
    () => ({
      opacity: showBubble.value ? 1 : 0,
      display: showBubble.value ? 'flex' : 'none',
      position: 'absolute',
      top: IS_ANDROID ? -72 : -60,
      left: 0,
      height: 70,
      width,
      transform: [
        {
          translateX: 0 - width / 2 + (IS_ANDROID ? 7 : 6),
        },
      ],
    }),
    [width],
  );

  const onSlidingStart = useCallback(() => {
    if (!disabled) {
      showBubble.value = true;
    }
  }, [showBubble, disabled]);

  const onAfterChangeSlider = useCallback(
    (v: number) => {
      onChangeSlider?.(v, true);
      showBubble.value = false;
    },
    [onChangeSlider, showBubble],
  );

  const prevToken = usePrevious(token);

  if (
    isFrom &&
    slider &&
    Number(value) === 0 &&
    onChangeSlider &&
    prevToken?.chain === token?.chain &&
    prevToken?.id === token?.id &&
    (token?.amount !== prevToken?.amount ||
      token?.raw_amount_hex_str !== prevToken?.raw_amount_hex_str)
  ) {
    console.debug('sync amount with token', slider);
    onAfterChangeSlider(slider);
  }

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
    <Pressable style={styles.container} onPress={handleTokenModalOpen}>
      <View style={styles.top}>
        <Text style={styles.subTitle}>
          {isFrom ? t('page.swap.from') : t('page.swap.to')}
        </Text>
        {isFrom && (
          <View style={styles.sliderContainer}>
            <Slider
              key={`${token?.id}-${token?.chain}`}
              allowTouchTrack={!disabled}
              disabled={disabled}
              style={styles.slider}
              value={slider}
              onSlidingStart={onSlidingStart}
              onValueChange={onChangeSlider}
              onSlidingComplete={onAfterChangeSlider}
              minimumValue={0}
              maximumValue={100}
              minimumTrackTintColor={colors2024['brand-default']}
              maximumTrackTintColor={colors2024['neutral-line']}
              step={1}
              thumbStyle={styles.thumbStyle}
              thumbProps={{
                children: (
                  <View>
                    <View style={[styles.outerThumb, { position: 'relative' }]}>
                      <View style={styles.innerThumb} />

                      <Animated.View style={sliderStyle}>
                        <BubbleWithText slide={slider || 0} />
                      </Animated.View>
                    </View>
                  </View>
                ),
              }}
            />
            <Text style={styles.sliderValue}>{slider}%</Text>
          </View>
        )}
      </View>

      <View style={styles.inputContainer}>
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
          }}>
          {isFrom ? (
            <TokenSelect
              ref={openTokenModalRef}
              token={token}
              onTokenChange={onTokenSelect}
              accountInScreen={account}
              chainId={chainId}
              type={'swapFrom'}
              placeholder={t('page.swap.search-by-name-address')}
            />
          ) : (
            <SwapToTokenSelect
              ref={openTokenModalRef}
              token={token}
              onTokenChange={onTokenSelect}
              accountInScreen={account}
              chainId={chainId}
              placeholder={t('page.swap.search-by-name-address')}
              searchPlaceholder={t(
                'component.TokenSelector.searchPlaceHolder1',
              )}
            />
          )}

          <Divider color={colors2024['neutral-line']} />
        </View>

        {valueLoading && skeletonLoading ? (
          <CustomSkeleton
            animation="wave"
            LinearGradientComponent={Linear}
            style={styles.skeleton}
          />
        ) : isFrom ? (
          <TextInput
            editable={!disabled}
            contextMenuHidden={disabled}
            numberOfLines={1}
            multiline={false}
            spellCheck={false}
            textAlign="right"
            keyboardType="numeric"
            inputMode="decimal"
            placeholder="0"
            value={value}
            scrollEnabled={true}
            placeholderTextColor={colors2024['neutral-info']}
            onChangeText={onInputChange}
            style={[
              styles.input,
              isFrom && inSufficient && styles.inSufficient,
            ]}
          />
        ) : (
          <Text
            numberOfLines={1}
            style={StyleSheet.flatten([
              styles.input,
              valueLoading && styles.loadingOpacity,
            ])}>
            {value ? formatTokenAmount(value) : '0'}
          </Text>
        )}
      </View>

      <View style={styles.bottom}>
        <View style={styles.balanceContainer}>
          <RcIconWalletCC
            width={16}
            height={16}
            color={
              inSufficient
                ? colors2024['red-default']
                : colors2024['neutral-foot']
            }
          />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.balance, inSufficient && styles.inSufficient]}>
            {balance}
          </Text>
        </View>
        <View style={styles.usdValueContainer}>
          {valueLoading && skeletonLoading ? (
            <CustomSkeleton
              animation="wave"
              LinearGradientComponent={Linear}
              style={styles.skeleton2}
            />
          ) : (
            <Text
              style={StyleSheet.flatten([
                styles.usdValue,
                valueLoading && styles.loadingOpacity,
              ])}>
              {usdValue}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
    height: 134,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTitle: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    gap: 8,
  },
  slider: {
    width: 126,
    height: 4,
  },
  sliderValue: {
    width: 40,
    textAlign: 'right',
    color: colors2024['brand-default'],
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'SF Pro',
  },
  input: {
    color: colors2024['neutral-title-1'],
    fontSize: 28,
    fontWeight: '700',
    paddingLeft: 0,
    borderWidth: 0,
    flex: 1,
    textAlign: 'right',
    padding: 0,
  },

  inSufficient: {
    color: colors2024['red-default'],
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 14,
    height: 36,
  },

  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  balance: {
    fontSize: 12,
    fontWeight: '400',
    maxWidth: 200,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  usdValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  usdValue: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  skeleton: {
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-line'],
    height: 36,
    width: 138,
    borderRadius: 100,
  },

  skeleton2: {
    backgroundColor: colors2024['neutral-line'],
    height: 18,
    width: 38,
    borderRadius: 100,
  },
  outerThumb: {
    width: 14,
    height: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  innerThumb: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: colors2024['brand-default'],
  },

  insufficient: {
    color: colors2024['red-default'],
  },

  thumbStyle: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 14,
    height: 14,
    backgroundColor: 'transparent',
  },
  loadingOpacity: {
    opacity: 0.5,
  },
}));
