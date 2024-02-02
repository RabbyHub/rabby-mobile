import { View, Text } from 'react-native';

import { Skeleton } from '@rneui/themed';
import TouchableView from '@/components/Touchable/TouchableView';
import RcMaxButton from './icons/max-button.svg';
import { TokenAmountInput } from '@/components/Token';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeTriangleStyle } from '@/utils/styles';
import { useSendTokenInternalContext } from './hooks/useSendToken';
import { useCurrentAccount } from '@/hooks/account';
import { devLog } from '@/utils/logger';
import GasReserved from './components/GasReserved';
import GasSelectorBottomSheetModal from './components/GasSelector';
import { CHAINS } from '@debank/common';

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

export function Section({
  children,
  style,
}: React.PropsWithChildren<RNViewProps>) {
  const colors = useThemeColors();
  const styles = getSectionStyles(colors);

  return <View style={[styles.sectionPanel, style]}>{children}</View>;
}

export function BalanceSection({ style }: RNViewProps) {
  const { styles } = useThemeStyles(getBalanceStyles);

  const { currentAccount } = useCurrentAccount();
  const {
    screenState: {
      isLoading,
      balanceError,
      balanceWarn,
      showGasReserved,
      selectedGasLevel,
      tokenAmountForGas,
      gasSelectorVisible,
      gasList,
    },

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
      handleClickTokenBalance,
      handleFieldChange,
      handleGasChange,
    },
  } = useSendTokenInternalContext();

  devLog('BalanceSection:: balanceError', balanceError);
  devLog('BalanceSection:: formValues.amount', formValues.amount);
  // devLog('BalanceSection:: showGasReserved', showGasReserved);
  // devLog('BalanceSection:: selectedGasLevel', selectedGasLevel);

  if (!currentToken) return null;

  return (
    <Section style={style}>
      <View className="mt-[0]" style={styles.titleSection}>
        <View style={styles.balanceArea}>
          {isLoading ? (
            <Skeleton style={{ width: 100, height: 16 }} />
          ) : (
            <>
              <Text style={styles.balanceText}>
                Balance: {currentTokenBalance}
              </Text>
              {/* max button */}
              {currentToken.amount > 0 && (
                <TouchableView
                  className="h-[100%] ml-[4]"
                  style={styles.maxButtonWrapper}
                  onPress={handleClickTokenBalance}>
                  <RcMaxButton />
                </TouchableView>
              )}
            </>
          )}
        </View>

        {/* right area */}
        <View style={styles.issueBlock}>
          {showGasReserved &&
            (selectedGasLevel ? (
              <GasReserved
                token={currentToken}
                amount={tokenAmountForGas}
                onClickAmount={() => {
                  putScreenState({ gasSelectorVisible: true });
                }}
                trigger="whole"
              />
            ) : (
              <Skeleton style={{ width: 180 }} />
            ))}
          {!showGasReserved && (balanceError || balanceWarn) ? (
            <Text style={[styles.issueText]}>
              {balanceError || balanceWarn}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-[10]">
        {currentAccount && chainItem && (
          <TokenAmountInput
            value={formValues.amount}
            onChange={value => {
              handleFieldChange?.('amount', value);
            }}
            token={currentToken}
            chainServerId={chainItem.serverId}
            onTokenChange={handleCurrentTokenChange}
            // excludeTokens={[]}
            inlinePrize
          />
        )}
      </View>
      <View className="mt-[16]">
        <View style={styles.tokenDetailBlock}>
          <View style={styles.tokenDetailTriangle} />
          <View style={styles.tokenDetailLine}>
            <Text style={styles.tokenDetailText}>Chain</Text>
            <Text style={[styles.tokenDetailText, styles.tokenDetailValue]}>
              {currentToken.name}
            </Text>
          </View>
          <View style={[styles.tokenDetailLine, { marginTop: 8 }]}>
            <Text style={styles.tokenDetailText}>Price</Text>
            <Text style={[styles.tokenDetailText, styles.tokenDetailValue]}>
              {currentTokenPrice}
            </Text>
          </View>
        </View>
      </View>

      <GasSelectorBottomSheetModal
        visible={gasSelectorVisible}
        onClose={() => {
          putScreenState({ gasSelectorVisible: false });
        }}
        chainId={chainItem?.id || CHAINS.ETH.id}
        onChange={val => {
          putScreenState({ gasSelectorVisible: false });
          handleGasChange(val);
        }}
        gasList={gasList}
        gas={selectedGasLevel}
        token={currentToken}
      />
    </Section>
  );
}

const getBalanceStyles = createGetStyles(colors => {
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

    balanceArea: {
      flexDirection: 'row',
      height: 16,
    },

    issueBlock: {
      flexDirection: 'row',
      height: 16,
    },

    issueText: {
      color: colors['red-default'],
    },

    tokenDetailBlock: {
      width: '100%',
      backgroundColor: colors['neutral-card2'],
      padding: 12,
      borderRadius: 4,
      position: 'relative',
    },

    tokenDetailTriangle: {
      position: 'absolute',
      left: 8,
      top: -8 * 2,
      ...makeTriangleStyle({
        dir: 'up',
        size: 12,
        color: colors['neutral-card2'],
      }),
      borderTopWidth: 8,
      borderLeftWidth: 10,
      borderRightWidth: 10,
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
  };
});
