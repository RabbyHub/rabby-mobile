import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  ARB_USDC_TOKEN_ITEM,
  HYPE_EVM_BRIDGE_ADDRESS,
  HYPE_GAS_FEE_IN_HYPE,
  isHypeWithdrawToken,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import {
  AccountSummary,
  MarketDataMap,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { Tip } from '@/components/Tip';
import { useUsdInput } from '@/hooks/useUsdInput';
import { formatPerpsUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { ITokenItem } from '@/store/tokens';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';
import { PerpsWithdrawSelectTokenPopup } from './PerpsWithdrawSelectTokenPopup';

export const PerpsWithdrawPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onWithdraw?(amount: string, isHypeWithdraw: boolean): void;
  accountSummary?: AccountSummary | null;
  marketDataMap?: MarketDataMap;
}> = ({ visible, onClose, onWithdraw, accountSummary, marketDataMap }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { availableBalance } = usePerpsAccount();
  const currentPerpsAccount = perpsStore(s => s.currentPerpsAccount);
  const { t } = useTranslation();

  const [tipVisible, setTipVisible] = useState(false);
  const hideTip = useCallback(() => setTipVisible(false), []);
  const [activationTipVisible, setActivationTipVisible] = useState(false);

  const [selectedToken, setSelectedToken] = useState<ITokenItem>(
    ARB_USDC_TOKEN_ITEM as ITokenItem,
  );
  const [tokenSelectVisible, setTokenSelectVisible] = useState(false);
  const isHypeWithdraw = isHypeWithdrawToken(selectedToken);

  // Fetch pre-transfer check for HyperEVM activation fee
  const { data: preTransferCheck } = useRequest(
    async () => {
      if (!isHypeWithdraw || !currentPerpsAccount?.address) {
        return null;
      }
      const sdk = apisPerps.getPerpsSDK();
      return sdk.info.getPreTransferCheck(
        HYPE_EVM_BRIDGE_ADDRESS,
        currentPerpsAccount.address,
      );
    },
    { refreshDeps: [isHypeWithdraw, currentPerpsAccount?.address] },
  );
  const activationFee = Number(preTransferCheck?.fee || '0');

  // Calculate HyperEVM gas fee in USD
  const hypeGasFeeUsd = useMemo(() => {
    const hypePrice = Number(marketDataMap?.HYPE?.markPx || 0);
    return new BigNumber(HYPE_GAS_FEE_IN_HYPE).times(hypePrice).toNumber();
  }, [marketDataMap]);

  // Effective balance after subtracting activation fee for HyperEVM
  const effectiveBalance = useMemo(() => {
    if (!isHypeWithdraw || activationFee <= 0) {
      return availableBalance;
    }
    return Math.max(
      0,
      new BigNumber(availableBalance)
        .minus(activationFee)
        .decimalPlaces(6, BigNumber.ROUND_DOWN)
        .toNumber(),
    );
  }, [isHypeWithdraw, availableBalance, activationFee]);

  useEffect(() => {
    const sub = Keyboard.addListener(
      IS_ANDROID ? 'keyboardDidHide' : 'keyboardWillHide',
      hideTip,
    );
    return () => sub.remove();
  }, [hideTip]);

  const {
    value: amount,
    displayedValue: displayedAmount,
    onChangeText: setAmount,
  } = useUsdInput();
  const { runAsync: handleWithdraw, loading } = useRequest(
    async () => {
      Keyboard.dismiss();
      const withdrawAmount = isHypeWithdraw
        ? new BigNumber(amount)
            .minus(hypeGasFeeUsd)
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed()
        : amount;
      await onWithdraw?.(withdrawAmount, isHypeWithdraw);
    },
    {
      manual: true,
    },
  );

  const amountValidation = React.useMemo(() => {
    const amountValue = Number(amount);
    if (amountValue === 0) {
      return { isValid: false, error: null };
    }

    if (Number.isNaN(+amount)) {
      return {
        isValid: false,
        error: 'invalid_number',
        errorMessage: t('page.perps.PerpsWithdrawPopup.invalidNumber'),
      };
    }

    if (amountValue > Number(effectiveBalance || 0)) {
      return {
        isValid: false,
        error: 'insufficient_balance',
        errorMessage: t('page.perps.PerpsWithdrawPopup.insufficientBalance'),
      };
    }
    if (amountValue < 2) {
      return {
        isValid: false,
        error: 'minimum_limit',
        errorMessage: t('page.perps.PerpsWithdrawPopup.minimumWithdrawSize'),
      };
    }

    return { isValid: true, error: null };
  }, [effectiveBalance, amount, t]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setAmount('');
      setSelectedToken(ARB_USDC_TOKEN_ITEM as ITokenItem);
    }
  }, [setAmount, visible]);

  const decimalPlaces = 2;

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        <BottomSheetView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perps.PerpsWithdrawPopup.title')}
            </Text>
          </View>
          <View style={styles.formItem}>
            <View style={styles.formItemLabelRow}>
              <Text style={styles.formItemLabel}>
                {t('page.perps.PerpsWithdrawPopup.amount')}
              </Text>
              <View style={styles.availableRow}>
                {isHypeWithdraw && activationFee > 0 ? (
                  <Tip
                    isVisible={activationTipVisible}
                    onClose={() => setActivationTipVisible(false)}
                    content={t(
                      'page.perps.PerpsWithdrawPopup.hypeActivationFeeTooltip',
                      {
                        fee: `$${new BigNumber(activationFee)
                          .decimalPlaces(decimalPlaces)
                          .toFixed()}`,
                      },
                    )}
                    placement="top">
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setActivationTipVisible(true);
                      }}>
                      <RcIconInfoCC
                        color={colors2024['neutral-secondary']}
                        width={16}
                        height={16}
                      />
                    </TouchableOpacity>
                  </Tip>
                ) : null}
                <Text style={styles.formItemDesc}>
                  {formatPerpsUsdValue(
                    effectiveBalance || 0,
                    BigNumber.ROUND_DOWN,
                  )}{' '}
                  {t('page.perps.PerpsWithdrawPopup.available')}
                </Text>
              </View>
            </View>
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <BottomSheetTextInput
                  value={displayedAmount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    !amountValidation.isValid && amount !== ''
                      ? styles.inputError
                      : null,
                  ]}
                  placeholder="$0"
                />
                <Text style={styles.tokenAmountHint}>
                  {amount || '0'} {getTokenSymbol(selectedToken)}
                </Text>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.tokenContainer}
                onPress={() => setTokenSelectVisible(true)}>
                <AssetAvatar
                  size={26}
                  chain={selectedToken?.chain}
                  logo={selectedToken?.logo_url}
                  chainSize={12}
                />
                <Text style={styles.tokenText}>
                  {getTokenSymbol(selectedToken)}
                </Text>
                <RcIconSwapBottomArrow />
              </TouchableOpacity>
            </View>
            <View style={styles.quickAmountRow}>
              {[
                { label: '25%', value: 0.25 },
                { label: '50%', value: 0.5 },
                { label: '75%', value: 0.75 },
              ].map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.quickAmountBtn}
                  onPress={() => {
                    const val = new BigNumber(effectiveBalance || 0)
                      .times(item.value)
                      .decimalPlaces(decimalPlaces, BigNumber.ROUND_DOWN)
                      .toFixed();
                    setAmount(val);
                  }}>
                  <Text style={styles.quickAmountText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => {
                  setAmount(
                    new BigNumber(effectiveBalance || 0)
                      .decimalPlaces(decimalPlaces, BigNumber.ROUND_DOWN)
                      .toFixed(),
                  );
                }}>
                <Text style={styles.quickAmountText}>Max</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.errorContainer}>
              {amountValidation.errorMessage ? (
                <Text style={styles.errorMessage}>
                  {amountValidation.errorMessage}
                </Text>
              ) : null}
            </View>

            <Tip
              isVisible={tipVisible}
              onClose={hideTip}
              topAdjustment={IS_ANDROID ? -10 : 10}
              content={
                isHypeWithdraw
                  ? t('page.perps.PerpsWithdrawPopup.hypeGasFeeTooltip')
                  : t('page.perps.PerpsWithdrawPopup.feeTooltipDesc')
              }
              placement="top">
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setTipVisible(true);
                }}
                style={styles.feeContainer}>
                <View style={styles.feeRow}>
                  <Text style={styles.fee}>
                    {isHypeWithdraw
                      ? t('page.perps.PerpsWithdrawPopup.hypeFeeTip', {
                          fee: new BigNumber(hypeGasFeeUsd)
                            .decimalPlaces(6)
                            .toFixed(),
                        })
                      : t('page.perps.PerpsWithdrawPopup.feeTip')}
                  </Text>
                  <RcIconInfoCC
                    color={colors2024['neutral-secondary']}
                    width={18}
                    height={18}
                  />
                </View>
              </TouchableOpacity>
            </Tip>
          </View>
          <Button
            type="hyperliquid"
            disabled={!amountValidation.isValid}
            title={t('page.perps.PerpsWithdrawPopup.withdrawBtn')}
            loading={loading}
            onPress={handleWithdraw}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
      <PerpsWithdrawSelectTokenPopup
        visible={tokenSelectVisible}
        onClose={() => setTokenSelectVisible(false)}
        onSelect={token => {
          setSelectedToken(token);
          setAmount('');
        }}
      />
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      paddingTop: 10,
      display: 'flex',
      flexDirection: 'column',
    },
    formItem: {
      flexShrink: 0,
    },
    formItemLabelRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    formItemLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      height: 98,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      ...(Platform.OS === 'ios' && {
        fontFamily: 'SF Pro Rounded',
      }),
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      flex: 1,
      minHeight: 52,
      paddingTop: 0,
      paddingBottom: 0,
    },
    inputError: {
      color: ctx.colors2024['red-default'],
    },
    errorContainer: {
      marginTop: 8,
      minHeight: 18,
    },
    errorMessage: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: ctx.colors2024['red-default'],
      flexShrink: 0,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },

    feeContainer: {
      marginTop: 20,
      marginBottom: 15,
    },
    feeRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-secondary'],
    },
    availableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    maxButtonWrapper: {
      padding: 4,
      backgroundColor: 'rgba(80, 210, 193, 0.12)',
      borderRadius: 8,
    },
    maxButtonText: {
      color: '#50D2C1',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    tokenContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 4,
      backgroundColor: ctx.colors2024['neutral-line'],
      borderRadius: 100,
      gap: 2,
    },
    tokenText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    inputWrapper: {
      flex: 1,
    },
    tokenAmountHint: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '400',
      color: ctx.colors2024['neutral-secondary'],
      marginTop: -4,
    },
    quickAmountRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    quickAmountBtn: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      backgroundColor: ctx.colors2024['neutral-bg-5'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickAmountText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-body'],
    },
  };
});
