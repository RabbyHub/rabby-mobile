import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { QuoteProvider, useSwapSupportedDexList } from '../hooks';
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

import TokenSelect from './TokenSelect';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
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
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';

interface SwapTokenItemProps {
  type: 'from' | 'to';
  token?: TokenItem;
  value: string;
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
}

export const SwapTokenItem = (props: SwapTokenItemProps) => {
  const {
    type,
    token,
    value,
    onTokenChange,
    onValueChange,
    excludeTokens,
    chainId,
    slider,
    onChangeSlider,
    inSufficient,
    valueLoading,
    currentQuote,
    finishedQuotes,
  } = props;
  const { t } = useTranslation();

  const { colors2024, styles } = useTheme2024({ getStyle });

  const isFrom = type === 'from';

  const dexLength = useSwapSupportedDexList()[0].length;

  const percent = useMemo(() => {
    if (finishedQuotes && !isFrom) {
      return (finishedQuotes / dexLength) * 100;
    }
    return 0;
  }, [dexLength, finishedQuotes, isFrom]);

  const openTokenModalRef = useRef<{
    openTokenModal: React.Dispatch<React.SetStateAction<boolean>>;
  }>(null);

  const handleTokenModalOpen = useCallback(() => {
    if (!valueLoading && !currentQuote && !isFrom) {
      openTokenModalRef?.current?.openTokenModal?.(true);
    }
  }, [currentQuote, isFrom, valueLoading]);

  const [balance, usdValue] = useMemo(() => {
    if (token) {
      const amount = tokenAmountBn(token);
      return [
        formatTokenAmount(amount.toString(10)),
        valueLoading
          ? formatUsdValue(0)
          : formatUsdValue(
              new BigNumber(value || 0).times(token.price).toString(10),
            ),
      ];
    }
    return [0, formatUsdValue(0)];
  }, [token, valueLoading, value]);

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
    if (!token || tokenAmountBn(token).lte(0)) {
      return;
    }
    showBubble.value = true;
  }, [showBubble, token]);

  const onAfterChangeSlider = useCallback(
    (v: number) => {
      onChangeSlider?.(v, true);
      showBubble.value = false;
    },
    [onChangeSlider, showBubble],
  );

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
              allowTouchTrack
              style={styles.slider}
              value={slider}
              onSlidingStart={onSlidingStart}
              onValueChange={onChangeSlider}
              onSlidingComplete={onAfterChangeSlider}
              minimumValue={0}
              maximumValue={100}
              disabled={!token || tokenAmountBn(token).lte(0)}
              minimumTrackTintColor={colors2024['brand-default']}
              maximumTrackTintColor={colors2024['neutral-line']}
              step={1}
              thumbStyle={{
                justifyContent: 'center',
                alignItems: 'center',
                width: 14,
                height: 14,
                backgroundColor: 'transparent',
              }}
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
          <TokenSelect
            ref={openTokenModalRef}
            token={token}
            onTokenChange={onTokenSelect}
            chainId={chainId}
            type={isFrom ? 'swapFrom' : 'swapTo'}
            placeholder={t('page.swap.search-by-name-address')}
            excludeTokens={excludeTokens}
            useSwapTokenList={!isFrom}
            supportChains={SWAP_SUPPORT_CHAINS}
            searchPlaceholder={
              isFrom
                ? undefined
                : t('component.TokenSelector.searchPlaceHolder1')
            }
          />
          <Divider color={colors2024['neutral-line']} />
        </View>

        {valueLoading ? (
          <View style={styles.skeleton}>
            <LinearGradient
              locations={[0, 1]}
              style={{
                width: `${percent}%`,
                height: '100%',
                backgroundColor: colors2024['brand-light-1'],
              }}
              start={{ x: 1, y: 0.5 }}
              end={{ x: 0, y: 0.5 }}
              colors={['rgba(112, 132, 255, 0.8)', 'rgba(112, 132, 255, 0.3)']}
            />
          </View>
        ) : isFrom ? (
          <TextInput
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
          <Text numberOfLines={1} style={StyleSheet.flatten([styles.input])}>
            {value || '0'}
          </Text>
        )}
      </View>

      <View style={styles.bottom}>
        <View style={styles.balanceContainer}>
          {!inSufficient && (
            <RcIconWalletCC
              width={16}
              height={16}
              color={colors2024['neutral-foot']}
            />
          )}
          <Text style={[styles.balance, inSufficient && styles.inSufficient]}>
            {inSufficient ? t('page.swap.insufficient') : ''}
            {balance}
          </Text>
        </View>
        <View style={styles.usdValueContainer}>
          {valueLoading ? (
            !isFrom ? null : (
              <Skeleton
                animation="wave"
                LinearGradientComponent={Linear}
                style={styles.skeleton2}
              />
            )
          ) : (
            <Text style={styles.usdValue}>{usdValue}</Text>
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
    backgroundColor: colors2024['brand-light-1'],
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
}));
