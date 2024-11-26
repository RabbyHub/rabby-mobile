import { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { Skeleton } from '@rneui/themed';
import { TokenAmountInput } from '@/components/Token';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import {
  useInputBlurOnEvents,
  useSendTokenInternalContext,
} from './hooks/useSendToken';
import { useCurrentAccount } from '@/hooks/account';
import { AddressViewer } from '@/components/AddressViewer';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { useTranslation } from 'react-i18next';
import { useFindChain } from '@/hooks/useFindChain';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { GasLevelType } from '@/components/ReserveGasPopup';
import { SendReserveGasPopup } from './components/SendReserveGasPopup';
import { checkIfTokenBalanceEnough } from '@/utils/token';
import { noop } from 'lodash';

export function BalanceSection({ style }: RNViewProps) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { currentAccount } = useCurrentAccount();
  const {
    screenState,

    formValues,
    computed: {
      chainItem,
      currentToken,
      currentTokenBalance,
      currentTokenPrice,
    },

    fns: { putScreenState },

    callbacks: {
      handleCurrentTokenChange,
      handleGasLevelChanged,
      handleFieldChange,
      handleClickMaxButton,
    },
  } = useSendTokenInternalContext();

  const tokenChain = useFindChain({
    serverId: currentToken?.chain,
  });

  const isNativeToken = useMemo(() => {
    if (!tokenChain || !currentToken) return true;
    return tokenChain.nativeTokenAddress === currentToken.id;
  }, [tokenChain, currentToken]);

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

  // devLog('BalanceSection:: balanceError', balanceError);
  // devLog('BalanceSection:: formValues.amount', formValues.amount);
  // devLog('BalanceSection:: showGasReserved', showGasReserved);
  // devLog(
  //   'BalanceSection:: screenState.selectedGasLevel',
  //   screenState.selectedGasLevel,
  // );

  if (!chainItem || !currentToken) return null;

  return (
    <View style={style}>
      <View className="mt-[0]" style={styles.titleSection}>
        <Text style={styles.sectionTitle}>Amount:</Text>

        <View style={styles.titleRight}>
          <View style={styles.issueBlock}>
            {screenState.showGasReserved && !screenState.selectedGasLevel && (
              <Skeleton style={styles.issueBlockSkeleton} />
            )}
            {!screenState.showGasReserved &&
            (screenState.balanceError || screenState.balanceWarn) ? (
              <Text style={[styles.issueText]}>
                {screenState.balanceError || screenState.balanceWarn}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.balanceArea}
            onPress={screenState.isLoading ? noop : handleClickMaxButton}>
            {screenState.isLoading ? (
              <Skeleton style={{ width: 100, height: 16 }} />
            ) : (
              <>
                <Text style={styles.balanceText}>
                  {t('page.sendToken.sectionBalance.title')}:{' '}
                  {currentTokenBalance}
                </Text>
                {/* max button */}
                {currentToken.amount > 0 &&
                  (screenState.isEstimatingGas ? (
                    <Skeleton
                      style={[styles.maxButtonWrapper, styles.maxButtonLoading]}
                    />
                  ) : (
                    <TouchableOpacity
                      disabled={screenState.isEstimatingGas}
                      style={styles.maxButtonWrapper}
                      onPress={handleClickMaxButton}>
                      <Text style={styles.maxButtonText}>MAX</Text>
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        {currentAccount && chainItem && (
          <TokenAmountInput
            ref={amountInputRef}
            value={formValues.amount}
            onChange={value => {
              handleFieldChange?.('amount', value);
            }}
            // selection={amountInputSelection || undefined}
            token={currentToken}
            chainServerId={chainItem.serverId}
            onTokenChange={handleCurrentTokenChange}
            // excludeTokens={[]}
            inlinePrize
          />
        )}
      </View>
      <View style={{ marginTop: 16 }}>
        <View style={styles.tokenDetailBlock}>
          <View style={styles.tokenDetailTriangle} />
          {!isNativeToken && (
            <View style={styles.tokenDetailLine}>
              <Text style={styles.tokenDetailText}>Contract Address</Text>
              <View style={styles.tokenDetailCopy}>
                <AddressViewer address={currentToken.id} showArrow={false} />
                <CopyAddressIcon address={currentToken.id} />
              </View>
            </View>
          )}
          <View style={[styles.tokenDetailLine]}>
            <Text style={styles.tokenDetailText}>Chain</Text>
            {tokenChain && (
              <Text style={[styles.tokenDetailText, styles.tokenDetailValue]}>
                {tokenChain.name}
              </Text>
            )}
          </View>
          <View style={[styles.tokenDetailLine, { marginTop: 8 }]}>
            <Text style={styles.tokenDetailText}>Price</Text>
            <Text style={[styles.tokenDetailText, styles.tokenDetailValue]}>
              {currentTokenPrice}
            </Text>
          </View>
        </View>
      </View>

      <SendReserveGasPopup
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
      />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const tipWrapperBg = colors2024['neutral-card-2'];

  return {
    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },

    balanceText: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },

    titleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    maxButtonWrapper: {
      marginLeft: 12,
      padding: 4,
      backgroundColor: colors2024['brand-light-1'],
      borderRadius: 8,
    },
    maxButtonText: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    maxButtonLoading: { width: 30, height: '100%', marginLeft: 2 },

    balanceArea: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    titleRight: {
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

    tokenDetailBlock: {
      width: '100%',
      backgroundColor: tipWrapperBg,
      padding: 12,
      borderRadius: 4,
      position: 'relative',
      justifyContent: 'center',
    },

    tokenDetailTriangle: {
      position: 'absolute',
      left: 16,
      top: -8 * 2,
      ...makeTriangleStyle({
        dir: 'up',
        size: 8,
        color: tipWrapperBg,
      }),
      borderTopWidth: 8,
      borderLeftWidth: 8,
      borderRightWidth: 8,
    },

    tokenDetailLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    tokenDetailText: {
      color: colors2024['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',
    },
    tokenDetailValue: {
      textAlign: 'right',
    },
    tokenDetailCopy: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
  };
});
