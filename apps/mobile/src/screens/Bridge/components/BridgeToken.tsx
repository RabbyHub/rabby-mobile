import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { tokenAmountBn } from '@/screens/Swap/utils';
import { useBridgeSupportedChains } from '../hooks';
import { ChainInfo } from './ChainInfo';
import BridgeToTokenSelect from './BridgeToTokenSelect';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import TokenSelect from '@/screens/Swap/components/TokenSelect';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { Skeleton, Slider } from '@rneui/themed';
import LinearGradient from 'react-native-linear-gradient';
import RcIconWalletCC from '@/assets2024/icons/swap/wallet-cc.svg';
import { Account } from '@/core/services/preference';
import { TokenItemMaybeWithOwner } from '@/databases/hooks/token';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import useAutoFocusInput from '@/hooks/useAutoFocusInput';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { IS_ANDROID } from '@/core/native/utils';
import { BubbleWithText } from '@/screens/Swap/components/Slider';

const hiddenSlider = false;

const BridgeToken = ({
  type = 'from',
  token,
  account,
  chain,
  excludeChains,
  onChangeToken,
  onChangeChain,
  value,
  onInputChange,
  valueLoading,
  fromChainId,
  fromTokenId,
  noQuote,
  inSufficient,
  clickMaxBtnCount,
  isMaxRef,
  handleMax,
  skeletonLoading,
  disabled,
  slider,
  onChangeSlider,
  onSliderScrollEnabledChange,
}: {
  clickMaxBtnCount?: number;
  handleMax?: () => void;
  isMaxRef?: React.MutableRefObject<boolean>;
  account: Account | null;
  chain?: CHAINS_ENUM;
  excludeChains?: CHAINS_ENUM[];
  onChangeToken: (token: TokenItem | TokenItemMaybeWithOwner) => void;
  onChangeChain: (chain: CHAINS_ENUM) => void;
  value?: string | number;
  onInputChange?: (v: string) => void;
  valueLoading?: boolean;
  fromChainId?: string;
  fromTokenId?: string;
  noQuote?: boolean;
  inSufficient?: boolean;
  skeletonLoading?: boolean;
  disabled?: boolean;
  slider?: number;
  onChangeSlider?: (value: number, syncAmount?: boolean) => void;
  onSliderScrollEnabledChange?: (enabled: boolean) => void;
} & (
  | {
      type?: 'from';
      token?: TokenItemMaybeWithOwner;
    }
  | {
      type?: 'to';
      token?: TokenItem;
    }
)) => {
  const { t } = useTranslation();

  const supportedChains = useBridgeSupportedChains();
  const { colors2024, styles } = useTheme2024({ getStyle });

  const isFromToken = type === 'from';
  const isToToken = type === 'to';

  const name = isFromToken ? t('page.bridge.From') : t('page.bridge.To');
  const chainObj = findChainByEnum(chain);
  const { inputCallbackRef, inputRef } = useAutoFocusInput(
    // !(isFromToken && !isMaxRef?.current),
    true,
  );

  useLayoutEffect(() => {
    isMaxRef && (isMaxRef.current = false);
  }, [value, isFromToken, isMaxRef]);

  useLayoutEffect(() => {
    if (clickMaxBtnCount) {
      handleScroll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickMaxBtnCount]);

  const handleScroll = () => {
    // setTimeout(() => {
    // scrollRef.current?.scrollTo({ y: 0, animated: true });
    inputRef.current?.blur();
    // }, 200);
  };

  const showNoQuote = useMemo(
    () => isToToken && !!noQuote,
    [noQuote, isToToken],
  );

  const useValue = useMemo(() => {
    if (token && value) {
      return formatUsdValue(
        new BigNumber(value).multipliedBy(token.price || 0).toString(),
      );
    }
    return '$0.00';
  }, [token, value]);

  const inputChange = React.useCallback(
    (text: string) => {
      onInputChange?.(text);
    },
    [onInputChange],
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
      onSliderScrollEnabledChange?.(false);
    }
  }, [showBubble, disabled, onSliderScrollEnabledChange]);

  const onAfterChangeSlider = useCallback(
    (v: number) => {
      onChangeSlider?.(v, true);
      showBubble.value = false;
      onSliderScrollEnabledChange?.(true);
    },
    [onChangeSlider, showBubble, onSliderScrollEnabledChange],
  );

  useEffect(() => {
    if (isFromToken && disabled) {
      onInputChange?.('');
    }
  }, [isFromToken, disabled, onInputChange]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{name}</Text>
        <ChainInfo
          type={isToToken ? 'to' : 'from'}
          hideTestnetTab={true}
          style={styles.chainSelector}
          chainEnum={chain}
          onChange={onChangeChain}
          account={account!}
          // excludeChains={excludeChains}
          // supportChains={supportedChains}
        />
        {isFromToken && !hiddenSlider && (
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

      <View style={styles.body}>
        <View style={styles.inputContainer}>
          <View style={styles.tokenSelectBox}>
            {/* {isFromToken && !value && (
              <TouchableOpacity
                activeOpacity={disabled ? 1 : undefined}
                onPress={disabled ? undefined : handleMax}
                style={styles.maxBtnBox}>
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            )} */}
            {isToToken ? (
              <BridgeToTokenSelect
                fromChainId={fromChainId!}
                fromTokenId={fromTokenId!}
                token={token}
                address={account?.address}
                onTokenChange={onChangeToken}
                chainId={chainObj?.serverId!}
                placeholder={t('page.swap.search-by-name-address')}
              />
            ) : (
              <TokenSelect
                // fromChainId={fromChainId!}
                // fromTokenId={fromTokenId!}
                accountInScreen={account}
                token={token}
                onTokenChange={onChangeToken}
                chainId={chainObj?.serverId!}
                type={'bridgeFrom'}
                placeholder={t('page.swap.search-by-name-address')}
                // supportChains={supportedChains}
              />
            )}
            <View style={styles.vecticalLine} />
          </View>
          {valueLoading && skeletonLoading ? (
            <CustomSkeleton
              animation="wave"
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          ) : isToToken ? (
            <Text
              numberOfLines={1}
              style={StyleSheet.flatten([
                styles.input,
                (showNoQuote || !value) && styles.showNoQuoteText,
                valueLoading && styles.loadingOpacity,
              ])}>
              {showNoQuote ? t('page.bridge.no-quote') : value?.toString() || 0}
            </Text>
          ) : (
            <View style={[styles.inputBox]}>
              <TextInput
                contextMenuHidden={disabled}
                editable={!disabled}
                numberOfLines={1}
                multiline={false}
                textAlign="right"
                keyboardType="numeric"
                inputMode="decimal"
                placeholderTextColor={colors2024['neutral-info']}
                style={[styles.input, inSufficient && styles.insufficientInput]}
                placeholder={'0'}
                scrollEnabled={true}
                value={value?.toString()}
                onChangeText={inputChange}
                ref={inputCallbackRef}
              />
            </View>
          )}
        </View>
        {
          <View style={[styles.footer, valueLoading && styles.loadingOpacity]}>
            <View style={styles.balanceContainer}>
              {
                <View style={styles.balanceWrapper}>
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
                    style={[
                      styles.balanceText,
                      inSufficient && styles.insufficientInput,
                    ]}>
                    {token
                      ? formatTokenAmount(tokenAmountBn(token).toString(10)) ||
                        '0'
                      : 0}
                  </Text>
                </View>
              }
            </View>
            <View style={styles.balanceContainer}>
              {<Text style={styles.value}>{useValue}</Text>}
            </View>
          </View>
        }
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderWidth: 0.5,
    // borderColor: '#D0D8E0',
    height: 148,
    // width: '100%',
  },
  inSufficient: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginTop: 16,
    // marginHorizontal: 20,
  },
  inSufficientText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
    fontWeight: '400',
  },
  tokenSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxBtnBox: {
    borderRadius: 8,
    padding: 4,
    backgroundColor: colors2024['brand-light-1'],
    marginRight: 8,
  },
  maxBtnText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: colors2024['neutral-line'],
  },
  headerRight: {},
  chainSelector: {
    height: 32,
    marginLeft: 8,
  },
  vecticalLine: {
    marginLeft: 12,
    marginRight: 12,
    borderWidth: 0,
    borderLeftWidth: 1,
    width: 0,
    height: 27,
    borderColor: colors2024['neutral-line'],
  },
  headerText: {
    color: colors2024['neutral-body'],
    fontWeight: '500',
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  body: {
    // padding: 16,
    paddingHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 56,
    alignItems: 'center',
  },
  showNoQuoteText: {
    color: colors2024['neutral-info'],
  },
  inputBox: {
    flex: 1,
    height: 36,
  },
  input: {
    flex: 1,
    textAlign: 'right',
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
  },
  insufficientInput: {
    color: colors2024['red-default'],
  },
  skeleton: {
    // marginTop: 16,
    backgroundColor: colors2024['neutral-line'],
    height: 36,
    width: 138,
    borderRadius: 100,
  },
  footer: {
    // marginTop: 14,
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 13,
    color: '#6A7587',
  },
  infoIcon: {
    marginLeft: 4,
  },
  balanceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  balanceText: {
    fontSize: 13,
    color: '#6A7587',
    maxWidth: 220,
  },
  loadingOpacity: {
    opacity: 0.5,
  },
  sliderContainer: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    gap: 0,
  },
  slider: {
    maxWidth: 126,
    flex: 1,
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
  thumbStyle: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 14,
    height: 14,
    backgroundColor: 'transparent',
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
}));

export default BridgeToken;
