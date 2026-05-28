import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Skeleton, Slider } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import {
  apiSendToken,
  useInputBlurOnEvents,
  useSendTokenInternalContext,
} from './hooks/useSendToken';
import { useTranslation } from 'react-i18next';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { GasLevelType } from '@/components/ReserveGasPopup';
import { SendReserveGasPopup } from './components/SendReserveGasPopup';
import { checkIfTokenBalanceEnough } from '@/utils/token';
import { noop } from 'lodash';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { IS_ANDROID } from '@/core/native/utils';
import { BubbleWithText } from '@/screens/Swap/components/Slider';
import { tokenAmountBn } from '../Swap/utils';
import BigNumber from 'bignumber.js';
import usePrevious from 'react-use/lib/usePrevious';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { Text, TextInput } from '@/components/Typography';
import {
  SendAmountInput,
  SendAmountInputMode,
} from './components/SendAmountInput';
import { formatSpeicalAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';

const USD_INPUT_REGEX = /^\d*(\.\d{0,2})?$/;
const TOKEN_INPUT_REGEX = /^\d*(\.\d*)?$/;

function getSendAmountTokenKey(token?: { chain?: string; id?: string } | null) {
  return token ? `${token.chain}:${token.id}` : '';
}

function isValidUsdPrice(price?: number | string | null) {
  const bn = new BigNumber(price || 0);
  return bn.isFinite() && !bn.isNaN() && bn.gt(0);
}

function getSafeAmountBn(amount?: string | number | BigNumber | null) {
  const bn = new BigNumber(amount || 0);
  return bn.isFinite() && !bn.isNaN() ? bn : new BigNumber(0);
}

function formatFixedUsdAmountText(value: BigNumber) {
  const fixedValue = value.toFixed(2);
  const [intPart, decimalPart] = fixedValue.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const absIntPart = sign ? intPart.slice(1) : intPart;
  const groupedIntPart = absIntPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${sign}${groupedIntPart}.${decimalPart || '00'}`;
}

function formatUsdQuoteValueText(value: string | number | BigNumber) {
  const bn = getSafeAmountBn(value);

  if (bn.isZero()) {
    return '0';
  }
  if (bn.gt(0) && bn.lt(0.01)) {
    return '<0.01';
  }

  return formatFixedUsdAmountText(bn);
}

function formatTokenQuoteValueText(value: string | number | BigNumber) {
  const bn = getSafeAmountBn(value);

  if (bn.isZero()) {
    return '0';
  }

  const displayValue = bn.decimalPlaces(6).toFixed();
  const [intPart, displayDecimalPart] = displayValue.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const absIntPart = sign ? intPart.slice(1) : intPart;
  const groupedIntPart = absIntPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return displayDecimalPart
    ? `${sign}${groupedIntPart}.${displayDecimalPart}`
    : `${sign}${groupedIntPart}`;
}

function formatUsdInputValueFromTokenAmount(
  tokenAmount: string,
  price: number,
) {
  if (!tokenAmount || !isValidUsdPrice(price)) {
    return '';
  }

  const usdValue = new BigNumber(tokenAmount).times(price);
  if (!usdValue.isFinite() || usdValue.isNaN()) {
    return '';
  }

  return usdValue.decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed();
}

export function BalanceSection({
  style,
  disableItemCheck,
}: RNViewProps & {
  disableItemCheck?: ITokenCheck;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const {
    screenState,

    slider,
    formValues,
    directSignBtnRef,
    computed: { chainItem, currentToken, currentTokenBalance },

    callbacks: {
      handleGasLevelChanged,
      handleFieldChange,
      handleClickMaxButton,
      checkCexSupport,
      onChangeSlider,
      setSlider,
      // isAuthInProgress,
    },
  } = useSendTokenInternalContext();

  const amountInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(amountInputRef);
  const [inputMode, setInputMode] = useState<SendAmountInputMode>('token');
  const [usdInputValue, setUsdInputValue] = useState('');
  const lastUsdInputTokenAmountRef = useRef('');
  const [usdPriceSnapshot, setUsdPriceSnapshot] = useState<{
    tokenKey: string;
    price: number | null;
  }>({
    tokenKey: '',
    price: null,
  });

  const currentTokenKey = useMemo(
    () => getSendAmountTokenKey(currentToken),
    [currentToken],
  );

  useEffect(() => {
    setInputMode('token');
    setUsdInputValue('');
    lastUsdInputTokenAmountRef.current = '';
  }, [currentTokenKey]);

  useEffect(() => {
    if (!currentToken) {
      return;
    }

    const tokenKey = getSendAmountTokenKey(currentToken);
    const nextPrice = isValidUsdPrice(currentToken.price)
      ? Number(currentToken.price)
      : null;

    setUsdPriceSnapshot(prev => {
      if (prev.tokenKey !== tokenKey) {
        return {
          tokenKey,
          price: nextPrice,
        };
      }

      if (!isValidUsdPrice(prev.price) && nextPrice !== null) {
        return {
          tokenKey,
          price: nextPrice,
        };
      }

      return prev;
    });
  }, [currentToken]);

  const activeUsdPrice = useMemo(() => {
    if (
      usdPriceSnapshot.tokenKey === currentTokenKey &&
      isValidUsdPrice(usdPriceSnapshot.price)
    ) {
      return usdPriceSnapshot.price;
    }

    return null;
  }, [currentTokenKey, usdPriceSnapshot]);

  useEffect(() => {
    if (!activeUsdPrice && inputMode === 'usd') {
      setInputMode('token');
      setUsdInputValue('');
      lastUsdInputTokenAmountRef.current = '';
    }
  }, [activeUsdPrice, inputMode]);

  useEffect(() => {
    if (currentToken && screenState.gasList) {
      const result = checkIfTokenBalanceEnough(currentToken, {
        gasList: screenState.gasList,
        gasLimit: MINIMUM_GAS_LIMIT,
      });

      if (result.isNormalEnough && result.normalLevel) {
        apiSendToken.putScreenState({ selectedGasLevel: result.normalLevel });
      } else if (result.isSlowEnough && result.slowLevel) {
        apiSendToken.putScreenState({ selectedGasLevel: result.slowLevel });
      } else if (result.customLevel) {
        apiSendToken.putScreenState({ selectedGasLevel: result.customLevel });
      }
    }
  }, [currentToken, screenState.gasList]);

  const showBubble = useSharedValue(false);

  const { width } = useWindowDimensions();

  const onSlidingStart = useCallback(() => {
    showBubble.value = true;
  }, [showBubble]);

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

  const onAfterChangeSlider = useCallback(
    (v: number) => {
      onChangeSlider?.(v, true);
      showBubble.value = false;
    },
    [onChangeSlider, showBubble],
  );

  const updateSliderByTokenAmount = useCallback(
    (tokenAmount: string) => {
      const safeTokenAmount = getSafeAmountBn(tokenAmount);
      const sliderValue = tokenAmount
        ? Number(
            safeTokenAmount
              .div(currentToken?.amount ? tokenAmountBn(currentToken) : 1)
              .times(100)
              .toFixed(0),
          )
        : 0;
      setSlider(sliderValue < 0 ? 0 : sliderValue > 100 ? 100 : sliderValue);
    },
    [currentToken, setSlider],
  );

  const handleTokenAmountChange = useCallback(
    (value: string) => {
      if (directSignBtnRef.current?.isAuthInProgress()) return false;
      try {
        const nextValue = formatSpeicalAmount(value);
        if (!TOKEN_INPUT_REGEX.test(nextValue)) {
          return false;
        }

        lastUsdInputTokenAmountRef.current = '';
        handleFieldChange?.('amount', nextValue);
        updateSliderByTokenAmount(nextValue);
      } catch (e) {
        console.error('handleTokenAmountChange error', e);
      }
    },
    [handleFieldChange, updateSliderByTokenAmount, directSignBtnRef],
  );

  const handleUsdAmountChange = useCallback(
    (value: string) => {
      if (directSignBtnRef.current?.isAuthInProgress()) return false;
      if (!activeUsdPrice) return false;

      try {
        const nextValue = formatSpeicalAmount(value);
        if (!USD_INPUT_REGEX.test(nextValue)) {
          return false;
        }

        let tokenAmount = '';
        if (nextValue && nextValue !== '.') {
          const nextTokenAmount = new BigNumber(nextValue).div(activeUsdPrice);
          tokenAmount =
            nextTokenAmount.isFinite() && !nextTokenAmount.isNaN()
              ? nextTokenAmount.toFixed()
              : '';
        }

        setUsdInputValue(nextValue);
        lastUsdInputTokenAmountRef.current = tokenAmount;
        handleFieldChange?.('amount', tokenAmount);
        updateSliderByTokenAmount(tokenAmount);
      } catch (e) {
        console.error('handleUsdAmountChange error', e);
      }
    },
    [
      activeUsdPrice,
      handleFieldChange,
      updateSliderByTokenAmount,
      directSignBtnRef,
    ],
  );

  useEffect(() => {
    if (inputMode !== 'usd' || !activeUsdPrice) {
      return;
    }

    const tokenAmount = formValues.amount || '';
    if (lastUsdInputTokenAmountRef.current === tokenAmount) {
      return;
    }

    setUsdInputValue(
      formatUsdInputValueFromTokenAmount(tokenAmount, activeUsdPrice),
    );
  }, [activeUsdPrice, formValues.amount, inputMode]);

  const handleAmountInputModeSwitch = useCallback(() => {
    if (!activeUsdPrice) {
      return;
    }

    if (directSignBtnRef.current?.isAuthInProgress()) {
      return;
    }

    setUsdInputValue('');
    lastUsdInputTokenAmountRef.current = '';
    handleFieldChange?.('amount', '');
    updateSliderByTokenAmount('');
    setInputMode(prev => (prev === 'token' ? 'usd' : 'token'));
  }, [
    activeUsdPrice,
    directSignBtnRef,
    handleFieldChange,
    updateSliderByTokenAmount,
  ]);

  const sliderDisable = useMemo(() => {
    return screenState.isLoading || screenState.isEstimatingGas;
  }, [screenState]);

  const previousAddress = usePrevious(currentAccount?.address);
  useEffect(() => {
    if (previousAddress && previousAddress !== currentAccount?.address) {
      onChangeSlider(0, true);
    }
  }, [previousAddress, currentAccount?.address, onChangeSlider]);

  if (!chainItem || !currentToken) {
    return null;
  }

  const tokenSymbol = getTokenSymbol(currentToken);
  const safeFormAmount = getSafeAmountBn(formValues.amount);
  const amountInputValue =
    inputMode === 'usd' ? usdInputValue : formValues.amount;
  const amountInputUnit = inputMode === 'usd' ? 'USD' : tokenSymbol;
  const quoteValueText =
    inputMode === 'usd'
      ? formatTokenQuoteValueText(safeFormAmount)
      : formatUsdQuoteValueText(safeFormAmount.times(activeUsdPrice || 0));
  const quoteUnit = inputMode === 'usd' ? tokenSymbol : 'USD';
  const handleAmountChange =
    inputMode === 'usd' ? handleUsdAmountChange : handleTokenAmountChange;

  return (
    <View style={style}>
      <View style={styles.titleSection}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.newAmount')}</Text>
        <TouchableOpacity
          style={styles.balanceArea}
          onPress={screenState.isLoading ? noop : handleClickMaxButton}>
          {screenState.showBalanceLoading ? (
            <Skeleton style={{ width: 100, height: 16 }} />
          ) : (
            <>
              {!screenState.showGasReserved &&
              (screenState.balanceError || screenState.balanceWarn) ? (
                <Text style={[styles.issueText]}>
                  {screenState.balanceError ? (
                    <>
                      {screenState.balanceError}: {currentTokenBalance}
                    </>
                  ) : screenState.balanceWarn ? (
                    <>{screenState.balanceWarn}</>
                  ) : null}
                </Text>
              ) : (
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.balanceText}>
                  {t('page.sendToken.sectionBalance.title')}:{' '}
                  {currentTokenBalance}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      <View>
        {currentAccount && chainItem && (
          <SendAmountInput
            ref={amountInputRef}
            currentAccount={currentAccount}
            value={amountInputValue}
            unit={amountInputUnit}
            quoteValueText={quoteValueText}
            quoteUnit={quoteUnit}
            onChange={handleAmountChange}
            canSwitchMode={!!activeUsdPrice}
            onSwitchMode={handleAmountInputModeSwitch}
            disableItemCheck={disableItemCheck}
            token={currentToken}
            isEstimatingGas={screenState.isEstimatingGas}
            handleClickMaxButton={handleClickMaxButton}
            onTokenChange={checkCexSupport}
            amountInputProps={makeTestIDProps(E2E_ID.send.amountInput)}
            maxButtonProps={makeTestIDProps(E2E_ID.send.amountMax)}
            tokenSelectProps={makeTestIDProps(E2E_ID.send.tokenSelector)}
          />
        )}
      </View>

      {/* <SendReserveGasPopup
        selectedItem={screenState.selectedGasLevel?.level as GasLevelType}
        chain={chainItem?.enum}
        limit={Math.max(screenState.estimatedGas, MINIMUM_GAS_LIMIT)}
        onGasChange={gasLevel => {
          handleGasLevelChanged(gasLevel);
        }}
        gasList={screenState.gasList}
        visible={screenState.reserveGasOpen}
        rawHexBalance={currentToken.raw_amount_hex_str}
        onClose={gasLevel => handleGasLevelChanged(gasLevel)}
      /> */}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },

    slider: {
      maxWidth: 126,
      flex: 1,
      height: 4,
    },
    balanceText: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      maxWidth: 240,
    },

    titleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 26,
      marginBottom: 12,
    },

    balanceArea: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    issueBlock: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },

    gasReserved: {
      paddingLeft: 8,
    },

    issueBlockSkeleton: {
      width: '100%',
      maxWidth: 120,
      height: '100%',
    },

    issueText: {
      color: colors2024['red-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
    },

    tokenDetail: {
      marginTop: 13,
    },

    tokenDetailTriangle: {
      position: 'absolute',
      right: 56,
      top: -5,
      width: 8,
      height: 8,
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      transform: [{ rotate: '45deg' }],
      borderBottomWidth: 0,
      borderRightWidth: 0,
      backgroundColor: colors2024['neutral-bg-1'],
      borderRadius: 0,
    },
    tokenDetailBlock: {
      width: '100%',
      paddingHorizontal: 12,
      paddingVertical: 10,
      paddingTop: 16,
      borderRadius: 4,
      position: 'relative',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      gap: 6,
    },

    tokenDetailLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    tokenDetailText: {
      color: colors2024['neutral-secondary'],
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      fontFamily: 'SF Pro Rounded',
    },
    tokenDetailValue: {
      textAlign: 'right',
      color: colors2024['neutral-body'],
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      fontFamily: 'SF Pro Rounded',
    },
    tokenDetailCopy: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
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
  };
});
