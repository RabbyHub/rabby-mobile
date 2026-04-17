/* eslint-disable react-native/no-inline-styles */
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PerpsQuoteAsset } from '@/constant/perps';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { useUsdInput } from '@/hooks/useUsdInput';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  TouchableOpacity,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { Text } from '@/components/Typography';
import { apisPerps } from '@/core/apis';
import RcIconUSDC from '@/assets2024/icons/perps/IconUSDC.svg';
import RcIconUSDT from '@/assets2024/icons/perps/IconUSDT.svg';
import RcIconUSDH from '@/assets2024/icons/perps/IconUSDH.svg';
import RcIconUSDE from '@/assets2024/icons/perps/IconUSDE.svg';
import BigNumber from 'bignumber.js';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import RcIconSwapDeposit from '@/assets2024/icons/perps/IconSwapDeposit.svg';

const COIN_ICONS: Record<string, (size: number) => React.ReactNode> = {
  USDC: (s: number) => <RcIconUSDC width={s} height={s} />,
  USDT: (s: number) => <RcIconUSDT width={s} height={s} />,
  USDH: (s: number) => <RcIconUSDH width={s} height={s} />,
  USDE: (s: number) => <RcIconUSDE width={s} height={s} />,
};

const ALL_COINS = ['USDC', 'USDT', 'USDH', 'USDE'];
const STABLECOIN_SLIPPAGE = 0.01;

// Spot market coin identifiers for getAllMids (based on USDC)
export const SPOT_STABLE_COIN_NAME: Record<string, string> = {
  USDE: '@150',
  USDT: '@166',
  USDH: '@230',
};

export const PerpsSpotSwapPopup: React.FC<{
  visible?: boolean;
  targetAsset?: PerpsQuoteAsset;
  disableSwitch?: boolean;
  onClose(): void;
  onSwapSuccess?(): void;
  onDepositPress?(): void;
  onSpotOrder?(params: {
    coin: 'USDE' | 'USDT' | 'USDH';
    isBuy: boolean;
    size: string;
    limitPx: string;
  }): Promise<any>;
}> = ({
  visible,
  targetAsset,
  disableSwitch,
  onClose,
  onSwapSuccess,
  onDepositPress,
  onSpotOrder,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { spotBalancesMap } = usePerpsAccount();
  const [isLoading, setIsLoading] = useState(false);

  const [fromCoin, setFromCoin] = useState<string>('USDC');
  const [toCoin, setToCoin] = useState<string>(targetAsset || 'USDT');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const { value: amount, onChangeText: setAmount } = useUsdInput();

  // Mid prices for stablecoins (relative to USDC)
  const [midPrices, setMidPrices] = useState<Record<string, number>>({});

  // Sort coins by balance descending to pick defaults
  const sortedByBalance = useMemo(() => {
    return [...ALL_COINS].sort((a, b) => {
      const balA = Number(spotBalancesMap[a]?.available) || 0;
      const balB = Number(spotBalancesMap[b]?.available) || 0;
      return balB - balA;
    });
  }, [spotBalancesMap]);

  // Fetch mid prices when popup opens (with 30s TTL cache)
  const lastFetchTimeRef = useRef(0);
  const fetchMidPrices = useCallback(async () => {
    if (Date.now() - lastFetchTimeRef.current < 30000) {
      return;
    }
    try {
      const sdk = apisPerps.getPerpsSDK();
      const mids = await sdk.info.getAllMids();
      const prices: Record<string, number> = {};
      for (const [coin, midKey] of Object.entries(SPOT_STABLE_COIN_NAME)) {
        const px = mids[midKey];
        if (px) {
          prices[coin] = Number(px);
        }
      }
      setMidPrices(prices);
      lastFetchTimeRef.current = Date.now();
    } catch (e) {
      console.error('Failed to fetch mid prices:', e);
    }
  }, []);

  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      setShowFromDropdown(false);
      setShowToDropdown(false);
      setAmount('');
      fetchMidPrices();

      if (targetAsset) {
        // From detail page: fixed target
        setFromCoin('USDC');
        setToCoin(targetAsset);
      } else {
        // From home page: pick by balance
        const top1 = sortedByBalance[0];
        const top2 = sortedByBalance[1];
        const hasNonUsdcBalance =
          top1 !== 'USDC' ||
          (Number(spotBalancesMap[top1]?.available) || 0) > 0;

        if (hasNonUsdcBalance && top1 && top2 && top1 !== top2) {
          setFromCoin(top1);
          setToCoin(top2);
        } else {
          // Only USDC balance or no balance at all
          setFromCoin('USDC');
          setToCoin('USDT');
        }
      }
    } else {
      modalRef.current?.dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, targetAsset]);

  const fromBalance = useMemo(() => {
    const b = spotBalancesMap[fromCoin];
    return b ? Number(b.available) || 0 : 0;
  }, [fromCoin, spotBalancesMap]);

  const toOptions = ALL_COINS;

  // From: depends on Swap To selection
  // To=USDC → From can be any non-USDC; To=non-USDC → From must be USDC
  const fromOptions = useMemo(() => {
    if (toCoin === 'USDC') {
      return ALL_COINS.filter(c => c !== 'USDC');
    }
    return ['USDC'];
  }, [toCoin]);

  const handleFromChange = useCallback((coin: string) => {
    setFromCoin(coin);
    setShowFromDropdown(false);
  }, []);

  const handleToChange = useCallback(
    (coin: string) => {
      setToCoin(coin);
      setShowToDropdown(false);
      // Auto-adjust From based on new To
      if (coin === 'USDC') {
        // To=USDC, From should be non-USDC; keep current if valid, else pick first non-USDC
        if (fromCoin === 'USDC') {
          setFromCoin('USDT');
        }
      } else {
        // To=non-USDC, From must be USDC
        setFromCoin('USDC');
      }
    },
    [fromCoin],
  );

  const closeAllDropdowns = useCallback(() => {
    setShowFromDropdown(false);
    setShowToDropdown(false);
  }, []);

  const validation = useMemo(() => {
    const v = Number(amount) || 0;
    if (v === 0) {
      return { isValid: false, error: null };
    }
    if (Number.isNaN(+v)) {
      return {
        isValid: false,
        error: t('page.perps.PerpsSpotSwap.invalidAmount'),
      };
    }
    if (v < 10) {
      return {
        isValid: false,
        error: t('page.perps.PerpsSpotSwap.minimumAmount'),
      };
    }
    if (v > fromBalance) {
      return {
        isValid: false,
        error: t('page.perps.PerpsSpotSwap.insufficientBalance'),
      };
    }
    return { isValid: true, error: null };
  }, [amount, fromBalance, t]);

  // Get the mid price for the non-USDC coin in the pair
  const activeMidPrice = useMemo(() => {
    const nonUsdcCoin = fromCoin === 'USDC' ? toCoin : fromCoin;
    return midPrices[nonUsdcCoin] || 1;
  }, [fromCoin, toCoin, midPrices]);

  const estReceive = useMemo(() => {
    const v = Number(amount) || 0;
    if (v === 0) {
      return '0';
    }
    if (fromCoin === 'USDC') {
      // Buying toCoin: spend v USDC, receive v / midPrice toCoin
      return new BigNumber(v)
        .div(activeMidPrice)
        .toFixed(2, BigNumber.ROUND_DOWN);
    }
    // Selling fromCoin: spend v fromCoin, receive v * midPrice USDC
    return new BigNumber(v)
      .times(activeMidPrice)
      .toFixed(2, BigNumber.ROUND_DOWN);
  }, [amount, fromCoin, activeMidPrice]);

  const handleSwap = useCallback(async () => {
    if (!validation.isValid || !onSpotOrder) {
      return;
    }
    try {
      setIsLoading(true);
      Keyboard.dismiss();
      if (fromCoin === 'USDC') {
        // Buying toCoin with USDC: limitPx = midPrice * (1 + slippage)
        const limitPx = new BigNumber(activeMidPrice)
          .times(1 + STABLECOIN_SLIPPAGE)
          .toFixed(4);
        const size = new BigNumber(amount)
          .div(activeMidPrice)
          .toFixed(2, BigNumber.ROUND_DOWN);
        await onSpotOrder({
          coin: toCoin as 'USDE' | 'USDT' | 'USDH',
          isBuy: true,
          size,
          limitPx,
        });
      } else {
        // Selling fromCoin for USDC: limitPx = midPrice * (1 - slippage)
        const limitPx = new BigNumber(activeMidPrice)
          .times(1 - STABLECOIN_SLIPPAGE)
          .toFixed(4);
        await onSpotOrder({
          coin: fromCoin as 'USDE' | 'USDT' | 'USDH',
          isBuy: false,
          size: amount,
          limitPx,
        });
      }
      onSwapSuccess?.();
      onClose();
    } catch (e) {
      console.error('Spot swap failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [
    validation.isValid,
    amount,
    fromCoin,
    toCoin,
    activeMidPrice,
    onSpotOrder,
    onSwapSuccess,
    onClose,
  ]);

  const handleQuickAmount = useCallback(
    (pct: number) => {
      const val = new BigNumber(fromBalance)
        .times(pct)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toFixed();
      setAmount(val);
    },
    [fromBalance, setAmount],
  );

  // Render a coin selector pill
  const renderTokenPill = (
    coin: string,
    onPress: () => void,
    hasDropdown: boolean,
  ) => {
    if (!hasDropdown) {
      return (
        <View style={styles.tokenPill}>
          {COIN_ICONS[coin]?.(26)}
          <Text style={styles.tokenPillText}>{coin}</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity style={styles.tokenPill} onPress={onPress}>
        {COIN_ICONS[coin]?.(26)}
        <Text style={styles.tokenPillText}>{coin}</Text>
        <RcIconSwapBottomArrow />
      </TouchableOpacity>
    );
  };

  // Render dropdown with all coins, disabled ones greyed out
  const renderDropdown = (
    selected: string,
    selectableCoins: string[],
    onSelect: (c: string) => void,
  ) => (
    <View style={styles.dropdown}>
      {ALL_COINS.map(coin => {
        const isDisabled = !selectableCoins.includes(coin);
        const balance = spotBalancesMap[coin];
        const balVal = balance ? Number(balance.available) || 0 : 0;
        return (
          <TouchableOpacity
            key={coin}
            style={[
              styles.dropdownItem,
              isDisabled && styles.dropdownItemDisabled,
            ]}
            disabled={isDisabled}
            onPress={() => onSelect(coin)}>
            <View style={styles.dropdownItemLeft}>
              {COIN_ICONS[coin]?.(20)}
              <Text
                style={[
                  styles.dropdownItemText,
                  isDisabled && styles.dropdownItemDisabled,
                ]}>
                {coin}
              </Text>
            </View>
            <Text
              style={[
                styles.dropdownItemBalance,
                isDisabled && styles.dropdownItemDisabled,
              ]}>
              {balVal > 0 ? new BigNumber(balVal).toFixed(2) : '0'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      snapPoints={[480]}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore">
      <BottomSheetView style={styles.container}>
        <Pressable onPress={closeAllDropdowns} style={{ flex: 1 }}>
          <Text style={styles.title}>swap stablecoins</Text>

          {/* === Swap To === */}
          <View style={[styles.fieldSection, { zIndex: 2 }]}>
            <View style={styles.swapToRow}>
              <Text style={styles.fieldLabel}>
                {t('page.perps.PerpsSpotSwap.to')}
              </Text>
              {renderTokenPill(
                toCoin,
                () => {
                  if (disableSwitch) {
                    return;
                  }
                  Keyboard.dismiss();
                  setShowToDropdown(!showToDropdown);
                  setShowFromDropdown(false);
                },
                !disableSwitch,
              )}
            </View>
            <View style={styles.dropdownAnchor}>
              {showToDropdown &&
                renderDropdown(toCoin, toOptions, handleToChange)}
            </View>
          </View>

          {/* === From === */}
          <View style={styles.fieldSection}>
            <View style={styles.inputContainer}>
              <View style={styles.formLabelRow}>
                <Text style={styles.fieldLabel}>
                  {t('page.perps.PerpsSpotSwap.from')}
                </Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceText}>
                    {t('page.perps.PerpsSpotSwap.balance')}:{' '}
                    {new BigNumber(fromBalance).toFixed(2)}
                  </Text>
                  {onDepositPress && (
                    <TouchableOpacity onPress={onDepositPress}>
                      <RcIconSwapDeposit width={16} height={16} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.inputWrapper}>
                  <BottomSheetTextInput
                    keyboardType="numeric"
                    style={styles.input}
                    textAlignVertical="center"
                    placeholder="0"
                    placeholderTextColor={colors2024['neutral-info']}
                    value={amount}
                    onChangeText={setAmount}
                    numberOfLines={1}
                  />
                </View>
                <View style={styles.divider} />
                {renderTokenPill(
                  fromCoin,
                  () => {
                    if (disableSwitch) {
                      return;
                    }
                    Keyboard.dismiss();
                    setShowFromDropdown(!showFromDropdown);
                    setShowToDropdown(false);
                  },
                  !disableSwitch,
                )}
              </View>
            </View>
            <View style={styles.dropdownAnchor}>
              {showFromDropdown &&
                renderDropdown(fromCoin, fromOptions, handleFromChange)}
            </View>

            {/* Quick amounts */}
            <View style={styles.quickAmountRow}>
              {[
                { label: '25%', value: 0.25 },
                { label: '50%', value: 0.5 },
                { label: '75%', value: 0.75 },
              ].map(item => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.quickAmountBtn}
                  onPress={() => handleQuickAmount(item.value)}>
                  <Text style={styles.quickAmountText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.quickAmountBtn}
                onPress={() => handleQuickAmount(1)}>
                <Text style={styles.quickAmountText}>Max</Text>
              </TouchableOpacity>
            </View>

            {/* Est receive & error */}
            <View style={styles.bottomInfo}>
              {Number(amount) > 0 && !validation.error ? (
                <Text style={styles.estText}>
                  Est.Receive:{estReceive} {toCoin}
                </Text>
              ) : validation.error ? (
                <Text style={styles.errorText}>{validation.error}</Text>
              ) : null}
            </View>
          </View>

          {/* Fee
        {Number(amount) > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.feeText}>Fee: {fee}</Text>
          </View>
        )} */}

          <Button
            type="hyperliquid"
            title={t('page.perps.PerpsSpotSwap.swapBtn')}
            onPress={handleSwap}
            loading={isLoading}
            disabled={!validation.isValid}
          />
        </Pressable>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  container: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    paddingTop: 10,
    paddingBottom: 56,
    paddingHorizontal: 20,
    display: 'flex',
    flexDirection: 'column',
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
  fieldSection: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  fieldLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: '#23C0B0',
  },

  // === Swap To row ===
  swapToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  // === From section ===
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
    color: ctx.colors2024['neutral-foot'],
  },
  depositLink: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    color: '#50D2C1',
  },
  inputContainer: {
    // height: 92,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    // flexDirection: 'row',
    gap: 6,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    ...(Platform.OS === 'ios' && {
      fontFamily: 'SF Pro Rounded',
    }),
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: 0,
    color: ctx.colors2024['neutral-title-1'],
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: ctx.colors2024['neutral-line'],
  },

  // === Token pill (shared for From/To) ===
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    paddingRight: 8,
    backgroundColor: ctx.colors2024['neutral-line'],
    borderRadius: 100,
  },
  tokenPillText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
  },
  tokenPillArrow: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    color: ctx.colors2024['neutral-secondary'],
    marginLeft: 2,
  },

  // === Dropdown ===
  dropdownAnchor: {
    position: 'relative',
    height: 0,
    zIndex: 99,
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: -4,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemDisabled: {
    opacity: 0.5,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownItemText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['neutral-body'],
  },
  dropdownItemBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: ctx.colors2024['neutral-body'],
  },

  // === Quick amounts ===
  quickAmountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickAmountBtn: {
    flex: 1,
    height: 40,
    borderRadius: 6,
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

  // === Bottom info ===
  bottomInfo: {
    marginTop: 8,
    minHeight: 18,
    // marginLeft: 8,
    marginBottom: 12,
  },
  estText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: ctx.colors2024['neutral-secondary'],
  },
  errorText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: ctx.colors2024['red-default'],
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  feeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: ctx.colors2024['neutral-secondary'],
  },
}));
