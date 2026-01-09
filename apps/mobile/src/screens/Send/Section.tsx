import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Skeleton, Slider } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import {
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
import { TokenAmountInput } from '@/components/Token/TokenAmountInput';
import { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { IS_ANDROID } from '@/core/native/utils';
import { BubbleWithText } from '@/screens/Swap/components/Slider';
import { tokenAmountBn } from '../Swap/utils';
import BigNumber from 'bignumber.js';
import usePrevious from 'react-use/lib/usePrevious';

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
    computed: { chainItem, currentToken, currentTokenBalance },

    fns: { putScreenState },

    callbacks: {
      handleGasLevelChanged,
      handleFieldChange,
      handleClickMaxButton,
      checkCexSupport,
      onChangeSlider,
      setSlider,
    },
  } = useSendTokenInternalContext();

  const amountInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(amountInputRef);

  useEffect(() => {
    if (currentToken && screenState.gasList) {
      const result = checkIfTokenBalanceEnough(currentToken, {
        gasList: screenState.gasList,
        gasLimit: MINIMUM_GAS_LIMIT,
      });

      if (result.isNormalEnough && result.normalLevel) {
        putScreenState({ selectedGasLevel: result.normalLevel });
      } else if (result.isSlowEnough && result.slowLevel) {
        putScreenState({ selectedGasLevel: result.slowLevel });
      } else if (result.customLevel) {
        putScreenState({ selectedGasLevel: result.customLevel });
      }
    }
  }, [putScreenState, currentToken, screenState.gasList]);

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

  const handleAmountChange = useCallback(
    (value: string) => {
      try {
        handleFieldChange?.('amount', value);
        const sliderValue = value
          ? Number(
              new BigNumber(value || 0)
                .div(currentToken?.amount ? tokenAmountBn(currentToken) : 1)
                .times(100)
                .toFixed(0),
            )
          : 0;
        setSlider(sliderValue < 0 ? 0 : sliderValue > 100 ? 100 : sliderValue);
      } catch (e) {
        console.error('handleAmountChange error', e);
      }
    },
    [handleFieldChange, currentToken, setSlider],
  );

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

  return (
    <View style={style}>
      <View style={styles.titleSection}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.newAmount')}</Text>
        <TouchableOpacity
          style={styles.balanceArea}
          onPress={screenState.isLoading ? noop : handleClickMaxButton}>
          {screenState.isLoading ? (
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
          <TokenAmountInput
            ref={amountInputRef}
            defaultAccount={currentAccount}
            value={formValues.amount}
            onChange={handleAmountChange}
            disableItemCheck={disableItemCheck}
            chainId={chainItem.serverId}
            token={currentToken}
            isEstimatingGas={screenState.isEstimatingGas}
            handleClickMaxButton={handleClickMaxButton}
            onTokenChange={checkCexSupport}
            inSufficient={new BigNumber(formValues.amount).gt(
              new BigNumber(currentTokenBalance),
            )}
            inlinePrize
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
