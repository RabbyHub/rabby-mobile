import React, { useCallback, useEffect, useRef } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  apiSendToken,
  useInputBlurOnEvents,
  useSendTokenFormValuesSelector,
  useSendTokenInternalSelector,
  useSendTokenInternalShallowSelector,
} from './hooks/useSendToken';
import { useTranslation } from 'react-i18next';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { checkIfTokenBalanceEnough } from '@/utils/token';
import { noop } from 'lodash';
import { TokenAmountInput } from '@/components/Token/TokenAmountInput';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { tokenAmountBn } from '../Swap/utils';
import BigNumber from 'bignumber.js';
import usePrevious from 'react-use/lib/usePrevious';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { Text, TextInput } from '@/components/Typography';

const SyncSelectedGasLevel = React.memo(function SyncSelectedGasLevel() {
  const { currentToken, gasList } = useSendTokenInternalShallowSelector(
    ctx => ({
      currentToken: ctx.computed.currentToken,
      gasList: ctx.screenState.gasList,
    }),
  );

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

  const {
    balanceError,
    balanceWarn,
    currentTokenBalance,
    handleClickMaxButton,
    isLoading,
    showBalanceLoading,
    showGasReserved,
  } = useSendTokenInternalShallowSelector(ctx => ({
    balanceError: ctx.screenState.balanceError,
    balanceWarn: ctx.screenState.balanceWarn,
    currentTokenBalance: ctx.computed.currentTokenBalance,
    handleClickMaxButton: ctx.callbacks.handleClickMaxButton,
    isLoading: ctx.screenState.isLoading,
    showBalanceLoading: ctx.screenState.showBalanceLoading,
    showGasReserved: ctx.screenState.showGasReserved,
  }));

  return (
    <View style={styles.titleSection}>
      <Text style={styles.sectionTitle}>{t('page.sendToken.newAmount')}</Text>
      <TouchableOpacity
        style={styles.balanceArea}
        onPress={isLoading ? noop : handleClickMaxButton}>
        {showBalanceLoading ? (
          <Skeleton style={{ width: 100, height: 16 }} />
        ) : (
          <>
            {!showGasReserved && (balanceError || balanceWarn) ? (
              <Text style={[styles.issueText]}>
                {balanceError ? (
                  <>
                    {balanceError}: {currentTokenBalance}
                  </>
                ) : balanceWarn ? (
                  <>{balanceWarn}</>
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
  );
});

const SendAmountInput = React.memo(function SendAmountInput() {
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
    isEstimatingGas,
    onChangeSlider,
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
    isEstimatingGas: ctx.screenState.isEstimatingGas,
    onChangeSlider: ctx.callbacks.onChangeSlider,
    setSlider: ctx.callbacks.setSlider,
  }));

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const amountInputRef = useRef<TextInput>(null);
  useInputBlurOnEvents(amountInputRef);

  const handleAmountChange = useCallback<
    React.ComponentProps<typeof TokenAmountInput>['onChange'] & object
  >(
    value => {
      if (directSignBtnRef.current?.isAuthInProgress()) return false;
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
    [handleFieldChange, currentToken, setSlider, directSignBtnRef],
  );

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
    <View>
      {currentAccount && chainItem && (
        <TokenAmountInput
          ref={amountInputRef}
          currentAccount={currentAccount}
          value={amount}
          onChange={handleAmountChange}
          disableItemCheck={disableItemCheck}
          chainId={chainItem.serverId}
          token={currentToken}
          isEstimatingGas={isEstimatingGas}
          handleClickMaxButton={handleClickMaxButton}
          onTokenChange={checkCexSupport}
          inSufficient={new BigNumber(amount).gt(
            new BigNumber(currentTokenBalance),
          )}
          inlinePrize
          amountInputProps={makeTestIDProps(E2E_ID.send.amountInput)}
          maxButtonProps={makeTestIDProps(E2E_ID.send.amountMax)}
          tokenSelectProps={makeTestIDProps(E2E_ID.send.tokenSelector)}
        />
      )}

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
});

export const BalanceSection = React.memo(function BalanceSection({
  style,
}: RNViewProps) {
  const isReady = useSendTokenInternalSelector(
    ctx => !!ctx.computed.chainItem && !!ctx.computed.currentToken,
  );

  if (!isReady) {
    return null;
  }

  return (
    <View style={style}>
      <SyncSelectedGasLevel />
      <BalanceHeader />
      <SendAmountInput />
    </View>
  );
});

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
