import { useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput } from 'react-native';

import { Skeleton } from '@rneui/themed';
import { TokenAmountInput } from '@/components/Token';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import {
  createGetStyles,
  makeDebugBorder,
  makeTriangleStyle,
} from '@/utils/styles';
import {
  useInputBlurOnEvents,
  useSendTokenInternalContext,
} from './hooks/useSendToken';
import { useCurrentAccount } from '@/hooks/account';
import { AddressViewer } from '@/components/AddressViewer';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import TouchableView from '@/components/Touchable/TouchableView';
import { default as RcMaxButton } from './icons/max-button.svg';
import { useTranslation } from 'react-i18next';
import { useFindChain } from '@/hooks/useFindChain';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { GasLevelType } from '@/components/ReserveGasPopup';
import { SendReserveGasPopup } from './components/SendReserveGasPopup';
import { checkIfTokenBalanceEnough } from '@/utils/token';
import { noop } from 'lodash';
import { devLog } from '@/utils/logger';

const getSectionStyles = createGetStyles(colors => {
  return {
    sectionPanel: {
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors['neutral-card1'],
      width: '100%',
    },
  };
});

export function SendTokenSection({
  children,
  style,
}: React.PropsWithChildren<RNViewProps>) {
  const colors = useThemeColors();
  const styles = getSectionStyles(colors);

  return <View style={[styles.sectionPanel, style]}>{children}</View>;
}

export function BalanceSection({ style }: RNViewProps) {
  const { styles } = useThemeStyles(getBalanceStyles);
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
      handleReserveGasClose,
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
  devLog(
    'BalanceSection:: screenState.selectedGasLevel',
    screenState.selectedGasLevel,
  );

  if (!chainItem || !currentToken) return null;

  return (
    <SendTokenSection style={style}>
      <View className="mt-[0]" style={styles.titleSection}>
        <TouchableView
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
                  <TouchableView
                    disabled={screenState.isEstimatingGas}
                    className="h-[100%] ml-[4]"
                    style={styles.maxButtonWrapper}
                    onPress={handleClickMaxButton}>
                    <RcMaxButton />
                  </TouchableView>
                ))}
            </>
          )}
        </TouchableView>

        {/* right area */}
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
          <View style={[styles.tokenDetailLine, { marginTop: 8 }]}>
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
        limit={Math.max(screenState.estimateGas, MINIMUM_GAS_LIMIT)}
        onGasChange={gasLevel => {
          handleGasLevelChanged(gasLevel);
        }}
        gasList={screenState.gasList}
        visible={screenState.reserveGasOpen}
        rawHexBalance={currentToken.raw_amount_hex_str}
        onClose={() => handleReserveGasClose()}
      />
    </SendTokenSection>
  );
}

const getBalanceStyles = createGetStyles((colors, ctx) => {
  const tipWrapperBg = colors['neutral-card-3'];

  return {
    balanceText: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: 'normal',
    },

    titleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
    },
    maxButtonWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    maxButtonLoading: { width: 30, height: '100%', marginLeft: 2 },

    balanceArea: {
      flexDirection: 'row',
      height: 16,
      flexShrink: 0,
    },

    issueBlock: {
      flexDirection: 'row',
      height: 16,
      flexShrink: 1,
      width: '100%',
      justifyContent: 'flex-end',
      // ...makeDebugBorder(),
    },

    gasReserved: {
      paddingLeft: 8,
      // ...makeDebugBorder()
    },

    issueBlockSkeleton: {
      width: '100%',
      maxWidth: 120,
      height: '100%',
    },

    issueText: {
      color: colors['red-default'],
    },

    tokenDetailBlock: {
      width: '100%',
      backgroundColor: tipWrapperBg,
      padding: 12,
      borderRadius: 4,
      position: 'relative',
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
      color: colors['neutral-foot'],
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
