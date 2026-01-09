import React, {
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { SilentTouchableView } from '@/components/Touchable/TouchableView';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ITokenCheck, TokenSelectorProps } from './TokenSelectorSheetModal';
import { formatSpeicalAmount, splitNumberByStep } from '@/utils/number';
import { NumericInput } from '../Form/NumbericInput';
import TokenSelect from '@/screens/Swap/components/TokenSelect';
import { useTranslation } from 'react-i18next';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import LinearGradient from 'react-native-linear-gradient';

function useLoadTokenList({
  onTokenChange,
  ref,
}: {
  onTokenChange?: TokenAmountInputProps['onTokenChange'];
  ref?: React.RefObject<TextInput> | null;
} = {}) {
  const internalInputRef = useRef<TextInput>(null);
  const tokenInputRef = ref || internalInputRef;
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);

  const handleCurrentTokenChange = useCallback(
    (token: TokenItem) => {
      onTokenChange?.(token);
      setTokenSelectorVisible(false);
      tokenInputRef.current?.focus();
    },
    [onTokenChange, tokenInputRef],
  );

  return {
    tokenInputRef,
    tokenSelectorVisible,
    handleCurrentTokenChange,
  };
}

interface TokenAmountInputProps {
  token: TokenItem;
  value?: string;
  chainId: string;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  handleClickMaxButton?: () => Promise<void> | void;
  /**
   * @deprecated allow amountFocus = true to trigger focus,
   * just for compability
   */
  amountFocus?: boolean;
  inlinePrize?: boolean;
  excludeTokens?: TokenItem['id'][];
  className?: string;
  type?: TokenSelectorProps['type'];
  placeholder?: string;
  isEstimatingGas?: boolean;
  defaultAccount?: KeyringAccountWithAlias | null;
  disableItemCheck?: ITokenCheck;
  inSufficient?: boolean;
}

/**
 * @description like TokenAmountInput on Rabby
 */
export const TokenAmountInput = React.forwardRef<
  TextInput,
  React.PropsWithChildren<RNViewProps & TokenAmountInputProps>
>(
  (
    {
      token,
      value,
      onChange,
      chainId,
      onTokenChange,
      amountFocus,
      inlinePrize,
      excludeTokens = [],
      style,
      handleClickMaxButton,
      isEstimatingGas,
      placeholder,
      disableItemCheck,
      defaultAccount,
      inSufficient,
    },
    ref,
  ) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();

    const { tokenInputRef, tokenSelectorVisible, handleCurrentTokenChange } =
      useLoadTokenList({
        onTokenChange,
        ref: ref as React.RefObject<TextInput>,
      });

    useLayoutEffect(() => {
      if (amountFocus && !tokenSelectorVisible) {
        tokenInputRef.current?.focus();
      }
    }, [amountFocus, tokenSelectorVisible, tokenInputRef]);

    const { valueText } = useMemo(() => {
      const num = Number(value);

      const valueText = num
        ? `$${splitNumberByStep(((num || 0) * token.price || 0).toFixed(2))}`
        : '$0';

      return {
        valueNum: num,
        valueText,
      };
    }, [value, token.price]);
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
      <View style={[styles.container, style]}>
        <SilentTouchableView
          viewStyle={[
            styles.leftInputContainer,
            inlinePrize && !!valueText && styles.containerHasInlinePrize,
          ]}
          onPress={evt => {
            evt.stopPropagation();
            tokenInputRef.current?.focus();
          }}>
          {!value && token.amount > 0 && isEstimatingGas ? (
            <CustomSkeleton
              animation="wave"
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          ) : (
            <NumericInput
              style={[
                inlinePrize && !!valueText && styles.inputHasInlinePrize,
                styles.input,
              ]}
              value={value}
              onChangeText={(value: string) => {
                onChange?.(formatSpeicalAmount(value));
              }}
              ref={tokenInputRef}
              placeholder="0"
              placeholderTextColor={colors2024['neutral-info']}
              inputMode="decimal"
              keyboardType="numeric"
              numberOfLines={1}
            />
          )}
          <View style={styles.inlinePrizeContainer}>
            <Text
              style={styles.inlinePrizeText}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {valueText}
            </Text>
          </View>
        </SilentTouchableView>
        {/* max button */}
        {!value &&
          token.amount > 0 &&
          (isEstimatingGas ? null : (
            <>
              <TouchableOpacity
                disabled={isEstimatingGas}
                style={styles.maxButtonWrapper}
                onPress={handleClickMaxButton}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </>
          ))}
        {<View style={styles.placeholder} />}
        <View style={styles.rightToken}>
          <TokenSelect
            accountInScreen={defaultAccount}
            chainId={''}
            token={token}
            disableItemCheck={disableItemCheck}
            onTokenChange={handleCurrentTokenChange}
            type="send"
            placeholder={placeholder}
            supportChains={[]}
            style={{ borderRadius: 100 }}
          />
          {/* <View style={styles.balanceWrapper}>
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
                  ? formatTokenAmount(tokenAmountBn(token).toString(10)) || '0'
                  : 0}
              </Text>
            </View> */}
        </View>
      </View>
    );
  },
);

const PADDING = 12;

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      height: 98,
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 20,
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
    insufficientInput: {
      color: colors2024['red-default'],
    },

    placeholder: {
      height: 28,
      width: 1,
      backgroundColor: colors2024['neutral-line'],
      marginHorizontal: 12,
    },

    rightToken: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 12,
    },
    rightInner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 4,
      backgroundColor: colors2024['neutral-line'],
      borderRadius: 12,
    },
    rightTokenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rightArrow: {
      marginLeft: 2,
    },
    rightTokenSymbol: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
    },

    leftInputContainer: {
      flex: 1,
      paddingLeft: PADDING,
      paddingBottom: 16,
      // ...makeDebugBorder('red'),
    },
    containerHasInlinePrize: {},
    input: {
      fontSize: 28,
      fontWeight: '700',
      position: 'relative',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      // marginLeft: 7,
      flex: 1,
      paddingTop: 0,
      paddingBottom: 0,
    },
    inputHasInlinePrize: {
      // ...makeDebugBorder(),
    },
    inlinePrizeContainer: {
      height: 18,
      // ...makeDebugBorder(),
    },
    // 'text-r-neutral-foot text-12 text-right max-w-full truncate'
    inlinePrizeText: {
      color: colors2024['neutral-info'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    maxButtonWrapper: {
      marginLeft: 12,
      padding: 4,
      backgroundColor: colors2024['brand-light-1'],
      borderRadius: 8,
      // ...makeDebugBorder(),
    },
    maxButtonText: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
      fontFamily: 'SF Pro Rounded',
    },
    maxButtonLoading: { width: 30, height: '100%', marginLeft: 2 },
    skeleton: {
      marginTop: 16,
      marginBottom: 10,
      backgroundColor: colors2024['neutral-line'],
      height: 36,
      width: 120,
      borderRadius: 100,
    },
  };
});
