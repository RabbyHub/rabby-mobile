import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  apiSendToken,
  useInputBlurOnEvents,
  useSendTokenFormValuesSelector,
  useSendTokenInternalShallowSelector,
  useSendTokenScreenChainToken,
  useSendTokenScreenStateSelector,
  useSendTokenScreenStateShallowSelector,
} from './hooks/useSendToken';
import { useTranslation } from 'react-i18next';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { checkIfTokenBalanceEnough, getTokenSymbol } from '@/utils/token';
import { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { tokenAmountBn } from '../Swap/utils';
import BigNumber from 'bignumber.js';
import usePrevious from 'react-use/lib/usePrevious';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { Text, TextInput } from '@/components/Typography';
import {
  SendAmountInput as SendAmountInputControl,
  SendAmountInputMode,
} from './components/SendAmountInput';
import {
  formatLittleNumber,
  formatSpeicalAmount,
  formatTokenAmountInput,
} from '@/utils/number';

const USD_INPUT_REGEX = /^\d*(\.\d{0,2})?$/;
const TOKEN_INPUT_REGEX = /^\d*(\.\d*)?$/;
const SMALL_USD_AMOUNT_TEXT = '<0.01';

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

  const displayBn = bn.decimalPlaces(6);
  if (displayBn.isZero()) {
    return formatLittleNumber(bn.toFixed());
  }

  const displayValue = displayBn.toFixed();
  const [intPart, displayDecimalPart] = displayValue.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const absIntPart = sign ? intPart.slice(1) : intPart;
  const groupedIntPart = absIntPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return displayDecimalPart
    ? `${sign}${groupedIntPart}.${displayDecimalPart}`
    : `${sign}${groupedIntPart}`;
}

function getUsdValueFromTokenAmount(
  tokenAmount: string,
  price: number,
): BigNumber | null {
  if (!tokenAmount || !isValidUsdPrice(price)) {
    return null;
  }

  const usdValue = new BigNumber(tokenAmount).times(price);
  if (!usdValue.isFinite() || usdValue.isNaN()) {
    return null;
  }

  return usdValue;
}

function formatUsdInputValueFromTokenAmount(
  tokenAmount: string,
  price: number,
) {
  const usdValue = getUsdValueFromTokenAmount(tokenAmount, price);
  if (!usdValue) {
    return '';
  }

  return usdValue.decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed();
}

const SyncSelectedGasLevel = React.memo(function SyncSelectedGasLevel() {
  const gasList = useSendTokenScreenStateSelector(state => state.gasList);
  const { currentToken } = useSendTokenInternalShallowSelector(ctx => ({
    currentToken: ctx.computed.currentToken,
  }));

  useEffect(() => {
    if (currentToken && gasList) {
      const result = checkIfTokenBalanceEnough(currentToken, {
        gasList,
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
  }, [currentToken, gasList]);

  return null;
});

const BalanceHeader = React.memo(function BalanceHeader() {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { currentTokenBalance } = useSendTokenInternalShallowSelector(ctx => ({
    currentTokenBalance: ctx.computed.currentTokenBalance,
  }));
  const { balanceError, balanceWarn, showGasReserved } =
    useSendTokenScreenStateShallowSelector(state => ({
      balanceError: state.balanceError,
      balanceWarn: state.balanceWarn,
      showGasReserved: state.showGasReserved,
    }));
  const showIssue = !showGasReserved && (balanceError || balanceWarn);

  return (
    <View style={styles.titleSection}>
      <Text style={styles.sectionTitle}>{t('page.sendToken.newAmount')}</Text>
      {showIssue ? (
        <Text style={styles.issueText} numberOfLines={1} ellipsizeMode="tail">
          {balanceError
            ? `${balanceError}: ${currentTokenBalance}`
            : balanceWarn}
        </Text>
      ) : (
        <View style={styles.titleRightSpacer} />
      )}
    </View>
  );
});

const SendAmountInputSection = React.memo(function SendAmountInputSection() {
  const amount = useSendTokenFormValuesSelector(values => values.amount);
  const {
    chainItem,
    checkCexSupport,
    currentToken,
    currentTokenBalance,
    directSignBtnRef,
    disableItemCheck,
    handleClickMaxButton,
    handleFieldChange,
    setSlider,
  } = useSendTokenInternalShallowSelector(ctx => ({
    chainItem: ctx.computed.chainItem,
    checkCexSupport: ctx.callbacks.checkCexSupport,
    currentToken: ctx.computed.currentToken,
    currentTokenBalance: ctx.computed.currentTokenBalance,
    directSignBtnRef: ctx.directSignBtnRef,
    disableItemCheck: ctx.fns.disableItemCheck,
    handleClickMaxButton: ctx.callbacks.handleClickMaxButton,
    handleFieldChange: ctx.callbacks.handleFieldChange,
    setSlider: ctx.callbacks.setSlider,
  }));
  const { isEstimatingGas, isLoading, showBalanceLoading } =
    useSendTokenScreenStateShallowSelector(state => ({
      isEstimatingGas: state.isEstimatingGas,
      isLoading: state.isLoading,
      showBalanceLoading: state.showBalanceLoading,
    }));

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const amountInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(amountInputRef);
  const [inputMode, setInputMode] = useState<SendAmountInputMode>('token');
  const [usdInputValue, setUsdInputValue] = useState('');
  const [isUsdMaxAmountActive, setIsUsdMaxAmountActive] = useState(false);
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
  const amountInputHasValue = useMemo(() => {
    if (inputMode === 'usd') {
      return Boolean(usdInputValue || amount);
    }

    return Boolean(amount);
  }, [amount, inputMode, usdInputValue]);

  useEffect(() => {
    setInputMode('token');
    setUsdInputValue('');
    setIsUsdMaxAmountActive(false);
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

      if (amountInputHasValue) {
        return prev;
      }

      if (prev.price !== nextPrice) {
        return {
          tokenKey,
          price: nextPrice,
        };
      }

      return prev;
    });
  }, [amountInputHasValue, currentToken]);

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
      setIsUsdMaxAmountActive(false);
      lastUsdInputTokenAmountRef.current = '';
    }
  }, [activeUsdPrice, inputMode]);

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
        const nextValue = formatTokenAmountInput(value, currentToken?.decimals);
        if (!TOKEN_INPUT_REGEX.test(nextValue)) {
          return false;
        }

        lastUsdInputTokenAmountRef.current = '';
        setIsUsdMaxAmountActive(false);
        handleFieldChange?.('amount', nextValue);
        updateSliderByTokenAmount(nextValue);
      } catch (e) {
        console.error('handleTokenAmountChange error', e);
      }
    },
    [
      currentToken?.decimals,
      directSignBtnRef,
      handleFieldChange,
      updateSliderByTokenAmount,
    ],
  );
  const currentTokenDecimals = currentToken?.decimals;

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
          if (nextTokenAmount.isFinite() && !nextTokenAmount.isNaN()) {
            const tokenDecimals =
              typeof currentTokenDecimals === 'number' &&
              Number.isFinite(currentTokenDecimals) &&
              currentTokenDecimals > 0
                ? Math.floor(currentTokenDecimals)
                : 0;
            const normalizedTokenAmount = nextTokenAmount.decimalPlaces(
              tokenDecimals,
              BigNumber.ROUND_DOWN,
            );

            tokenAmount = normalizedTokenAmount.gt(0)
              ? normalizedTokenAmount.toFixed()
              : '';
          }
        }

        setUsdInputValue(nextValue);
        setIsUsdMaxAmountActive(false);
        lastUsdInputTokenAmountRef.current = tokenAmount;
        handleFieldChange?.('amount', tokenAmount);
        updateSliderByTokenAmount(tokenAmount);
      } catch (e) {
        console.error('handleUsdAmountChange error', e);
      }
    },
    [
      activeUsdPrice,
      currentTokenDecimals,
      directSignBtnRef,
      handleFieldChange,
      updateSliderByTokenAmount,
    ],
  );

  useEffect(() => {
    if (inputMode !== 'usd' || !activeUsdPrice) {
      return;
    }

    const tokenAmount = amount || '';
    if (lastUsdInputTokenAmountRef.current === tokenAmount) {
      return;
    }

    setUsdInputValue(
      formatUsdInputValueFromTokenAmount(tokenAmount, activeUsdPrice),
    );
  }, [activeUsdPrice, amount, inputMode]);

  const handleAmountInputModeSwitch = useCallback(() => {
    if (!activeUsdPrice) {
      return;
    }

    if (directSignBtnRef.current?.isAuthInProgress()) {
      return;
    }

    setUsdInputValue('');
    setIsUsdMaxAmountActive(false);
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

  const previousAddress = usePrevious(currentAccount?.address);
  useEffect(() => {
    if (previousAddress && previousAddress !== currentAccount?.address) {
      setInputMode('token');
      setUsdInputValue('');
      setIsUsdMaxAmountActive(false);
      lastUsdInputTokenAmountRef.current = '';
      handleFieldChange?.('amount', '');
      setSlider(0);
    }
  }, [previousAddress, currentAccount?.address, handleFieldChange, setSlider]);

  const normalizeAmountInputValue = useCallback(
    (nextValue: string) => {
      if (inputMode === 'usd') {
        return formatTokenAmountInput(nextValue, 2);
      }

      return formatTokenAmountInput(nextValue, currentToken?.decimals);
    },
    [currentToken?.decimals, inputMode],
  );

  const handleAmountInputMaxButton = useCallback(() => {
    if (inputMode === 'usd') {
      setIsUsdMaxAmountActive(true);
      lastUsdInputTokenAmountRef.current = '';
    }

    handleClickMaxButton();
  }, [handleClickMaxButton, inputMode]);

  if (!chainItem || !currentToken) {
    return null;
  }

  const tokenSymbol = getTokenSymbol(currentToken);
  const safeFormAmount = getSafeAmountBn(amount);
  const usdValueFromTokenAmount =
    inputMode === 'usd' && activeUsdPrice
      ? getUsdValueFromTokenAmount(amount, activeUsdPrice)
      : null;
  const amountInputValue = inputMode === 'usd' ? usdInputValue : amount;
  const amountInputDisplayValueText =
    isUsdMaxAmountActive &&
    usdValueFromTokenAmount?.gt(0) &&
    usdValueFromTokenAmount.lt(0.01)
      ? SMALL_USD_AMOUNT_TEXT
      : undefined;
  const amountInputPrefixText = inputMode === 'usd' ? '$' : '';
  const amountInputUnit = tokenSymbol;
  const amountInputMaxDecimalPlaces =
    inputMode === 'usd' ? 2 : currentToken.decimals;
  const showQuote = !!activeUsdPrice;
  const quoteText = activeUsdPrice
    ? inputMode === 'usd'
      ? `${formatTokenQuoteValueText(safeFormAmount)} ${tokenSymbol}`
      : `$${formatUsdQuoteValueText(safeFormAmount.times(activeUsdPrice))}`
    : '';
  const balanceText = currentTokenBalance
    ? `${currentTokenBalance} ${tokenSymbol}`
    : '';
  const handleAmountChange =
    inputMode === 'usd' ? handleUsdAmountChange : handleTokenAmountChange;

  return (
    <View>
      {currentAccount && chainItem && (
        <SendAmountInputControl
          ref={amountInputRef}
          currentAccount={currentAccount}
          value={amountInputValue}
          displayValueText={amountInputDisplayValueText}
          unit={amountInputUnit}
          inputPrefixText={amountInputPrefixText}
          showInputUnit={false}
          quoteText={quoteText}
          showQuote={showQuote}
          balanceText={balanceText}
          showBalanceLoading={showBalanceLoading}
          balanceDisabled={isLoading}
          onBalancePress={handleAmountInputMaxButton}
          maxDecimalPlaces={amountInputMaxDecimalPlaces}
          normalizeInputValue={normalizeAmountInputValue}
          onChange={handleAmountChange}
          canSwitchMode={!!activeUsdPrice}
          onSwitchMode={handleAmountInputModeSwitch}
          disableItemCheck={disableItemCheck as ITokenCheck}
          token={currentToken}
          isEstimatingGas={isEstimatingGas}
          handleClickMaxButton={handleAmountInputMaxButton}
          onTokenChange={checkCexSupport}
          amountInputProps={makeTestIDProps(E2E_ID.send.amountInput)}
          maxButtonProps={makeTestIDProps(E2E_ID.send.amountMax)}
          tokenSelectProps={makeTestIDProps(E2E_ID.send.tokenSelector)}
        />
      )}
    </View>
  );
});

export const BalanceSection = React.memo(function BalanceSection({
  style,
}: RNViewProps) {
  const initialTokenIdentityReady = useSendTokenScreenStateSelector(
    state => state.initialTokenIdentityReady,
  );
  const { chainItem: screenChainItem, currentToken: screenCurrentToken } =
    useSendTokenScreenChainToken();
  const { chainItem: internalChainItem, currentToken: internalCurrentToken } =
    useSendTokenInternalShallowSelector(ctx => ({
      chainItem: ctx.computed.chainItem,
      currentToken: ctx.computed.currentToken,
    }));
  const hasRenderedSyncedInitialTokenRef = useRef(false);

  const isReady = !!internalChainItem && !!internalCurrentToken;
  const isInitialTokenSynced =
    !!screenChainItem &&
    !!screenCurrentToken &&
    !!internalChainItem &&
    !!internalCurrentToken &&
    screenChainItem.serverId === internalChainItem.serverId &&
    getSendAmountTokenKey(screenCurrentToken).toLowerCase() ===
      getSendAmountTokenKey(internalCurrentToken).toLowerCase();

  if (initialTokenIdentityReady && isInitialTokenSynced) {
    hasRenderedSyncedInitialTokenRef.current = true;
  }

  if (
    !initialTokenIdentityReady ||
    !isReady ||
    !hasRenderedSyncedInitialTokenRef.current
  ) {
    return null;
  }

  return (
    <View style={style}>
      <SyncSelectedGasLevel />
      <BalanceHeader />
      <SendAmountInputSection />
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },

    slider: {
      maxWidth: 126,
      flex: 1,
      height: 4,
    },
    titleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 18,
      marginBottom: 8,
      paddingHorizontal: 8,
    },

    titleRightSpacer: {
      width: 197,
      height: 18,
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
      maxWidth: 240,
      textAlign: 'right',
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
