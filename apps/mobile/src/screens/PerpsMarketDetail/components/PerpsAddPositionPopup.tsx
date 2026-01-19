import AutoLockView from '@/components/AutoLockView';
import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import {
  formatPerpsUsdValue,
  formatUsdValue,
  splitNumberByStep,
} from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { PerpsSlider } from './PerpsSlider';
import { PERPS_MAX_NTL_VALUE, PERPS_MINI_USD_VALUE } from '@/constant/perps';
import BigNumber from 'bignumber.js';
import { calLiquidationPrice } from '@/utils/perps';
import { AssetPriceInfo } from './PerpsPriceInfo';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useUsdInput } from '@/hooks/useUsdInput';
import { AssetAvatar } from '@/components';
import { DistanceToLiquidationTag } from '@/screens/Perps/components/PerpsPositionSection/DistanceToLiquidationTag';

const isAndroid = Platform.OS === 'android';

export const PerpsAddPositionPopup: React.FC<{
  visible?: boolean;
  coin: string;
  coinLogo: string;
  activeAssetCtx: WsActiveAssetCtx['ctx'] | null;
  currentAssetCtx: MarketData | null;
  availableBalance: number;
  direction: 'Long' | 'Short';
  positionSize: string;
  szDecimals: number;
  pxDecimals: number;
  marginMode: 'cross' | 'isolated';
  marginUsed: number;
  liquidationPx: number;
  handlePressRiskTag: () => void;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  markPrice: number;
  leverageRang: [number, number]; // [min, max]
  onCancel: () => void;
  onConfirm: () => void;
  handleAddPosition: (tradeSize: string) => Promise<void>;
}> = ({
  visible,
  coin,
  coinLogo,
  activeAssetCtx,
  currentAssetCtx,
  availableBalance,
  leverage,
  direction,
  positionSize,
  marginMode,
  marginUsed,
  liquidationPx,
  handlePressRiskTag,
  leverageRang,
  markPrice,
  szDecimals,
  pnl,
  pnlPercent,
  pxDecimals,
  onCancel,
  onConfirm,
  handleAddPosition,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();
  const { showTipsPopup } = useTipsPopup();

  const [loading, setLoading] = useState<boolean>(false);
  const {
    value: margin,
    displayedValue,
    onChangeText: setMargin,
  } = useUsdInput();

  const addMargin = useMemo(() => {
    return Number(margin) || 0;
  }, [margin]);

  const addPosition = useMemoizedFn(async () => {
    setLoading(true);
    try {
      await handleAddPosition(tradeSize);
      onConfirm();
    } finally {
      setLoading(false);
    }
  });

  // Calculate slider percentage
  const sliderPercentage = React.useMemo(() => {
    if (addMargin === 0 || availableBalance === 0) {
      return 0;
    }
    return Math.min((addMargin / availableBalance) * 100, 100);
  }, [addMargin, availableBalance]);

  // Handle slider change
  const handleSliderChange = useMemoizedFn((value: number) => {
    const newMargin = (availableBalance * value) / 100;
    setMargin(
      new BigNumber(newMargin).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed(),
    );
  });

  // 计算交易金额
  const tradeAmount = React.useMemo(() => {
    return addMargin * leverage;
  }, [addMargin, leverage]);

  // 计算交易数量
  const tradeSize = React.useMemo(() => {
    if (!markPrice || !tradeAmount) {
      return '0';
    }
    return Number(tradeAmount / markPrice).toFixed(szDecimals);
  }, [markPrice, tradeAmount, szDecimals]);

  const totalSize = React.useMemo(() => {
    return (Number(tradeSize) + Number(positionSize)).toFixed(szDecimals);
  }, [tradeSize, positionSize, szDecimals]);

  // 验证 margin 输入
  const marginValidation = React.useMemo(() => {
    const marginValue = addMargin;
    const usdValue = marginValue * leverage;
    const sizeValue = Number(tradeSize) * markPrice;
    const maxValue = PERPS_MAX_NTL_VALUE;

    if (marginValue === 0) {
      return { isValid: false, error: null };
    }

    if (Number.isNaN(+marginValue)) {
      return {
        isValid: false,
        error: 'invalid_number',
        errorMessage: t(
          'page.perpsDetail.PerpsOpenPositionPopup.invalidNumber',
        ),
      };
    }

    if (marginValue > availableBalance) {
      return {
        isValid: false,
        error: 'insufficient_balance',
        errorMessage: t(
          'page.perpsDetail.PerpsOpenPositionPopup.insufficientBalance',
        ),
      };
    }

    if (sizeValue < PERPS_MINI_USD_VALUE) {
      // 最小订单限制 $10
      return {
        isValid: false,
        error: 'minimum_limit',
        errorMessage: t(
          'page.perpsDetail.PerpsOpenPositionPopup.minimumOrderSize',
        ),
      };
    }

    if (usdValue > maxValue) {
      return {
        isValid: false,
        error: 'maximum_limit',
        errorMessage: t(
          'page.perpsDetail.PerpsOpenPositionPopup.maximumOrderSize',
          {
            amount: `$${maxValue}`,
          },
        ),
      };
    }

    return { isValid: true, error: null };
  }, [addMargin, leverage, tradeSize, markPrice, availableBalance, t]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setMargin('');
    }
  }, [visible, setMargin]);

  // 计算预估清算价格
  const estimatedLiquidationPrice = React.useMemo(() => {
    if (!markPrice || !leverage) {
      return 0;
    }
    const maxLeverage = leverageRang[1];
    return calLiquidationPrice(
      markPrice,
      Number(addMargin + marginUsed),
      direction,
      Number(tradeSize) + Number(positionSize),
      Number(tradeAmount) + Number(positionSize) * Number(markPrice),
      maxLeverage,
    ).toFixed(pxDecimals);
  }, [
    markPrice,
    leverage,
    leverageRang,
    addMargin,
    direction,
    tradeSize,
    pxDecimals,
    tradeAmount,
    positionSize,
    marginUsed,
  ]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return Math.min(height - 100, 656);
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onCancel}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      snapPoints={[maxHeight]}>
      <AutoLockView style={[styles.container]}>
        <BottomSheetScrollView contentContainerStyle={styles.scrollViewContent}>
          <View>
            <Text style={styles.title}>
              {direction === 'Long'
                ? t('page.perpsDetail.PerpsAddPositionPopup.addToLong')
                : t('page.perpsDetail.PerpsAddPositionPopup.addToShort')}{' '}
              {coin}-USD
            </Text>
          </View>

          <AssetPriceInfo
            coin={coin}
            logoUrl={coinLogo || ''}
            activeAssetCtx={activeAssetCtx}
            currentAssetCtx={currentAssetCtx}
          />

          {/* Coin Info */}
          <View style={styles.card}>
            <View style={styles.leftSection}>
              <View style={styles.coinInfoRow}>
                <AssetAvatar logo={coinLogo} size={28} />
                <Text style={styles.coinName}>{coin}</Text>
                <View style={styles.crossTag}>
                  <Text style={styles.crossText}>
                    {marginMode === 'cross'
                      ? t('page.perpsDetail.PerpsPosition.cross')
                      : t('page.perpsDetail.PerpsPosition.isolated')}
                  </Text>
                </View>
              </View>
              <View style={styles.tagRow}>
                <View
                  style={[
                    styles.leverageTag,
                    {
                      backgroundColor:
                        direction === 'Long'
                          ? colors2024['green-light-1']
                          : colors2024['red-light-1'],
                    },
                  ]}>
                  <Text
                    style={[
                      styles.leverageText,
                      direction === 'Long' ? styles.longText : styles.shortText,
                    ]}>
                    {direction} {`${leverage}x`}
                  </Text>
                </View>
                <DistanceToLiquidationTag
                  liquidationPrice={liquidationPx}
                  markPrice={markPrice}
                  onPress={handlePressRiskTag}
                />
              </View>
            </View>
            <View style={styles.rightSection}>
              <Text style={styles.priceText}>
                {formatUsdValue(Number(marginUsed))}
              </Text>
              <Text
                style={[
                  styles.pnlText,
                  pnl >= 0 ? styles.pnlTextUp : styles.pnlTextDown,
                ]}>
                {pnl >= 0 ? '+' : '-'}${Math.abs(pnl || 0).toFixed(2)} (
                {pnl >= 0 ? '+' : ''}
                {pnlPercent.toFixed(2)}%)
              </Text>
            </View>
          </View>

          <View style={styles.amountSection}>
            <View style={styles.amountHeader}>
              <Text style={styles.amountLabel}>
                {t('page.perpsDetail.PerpsClosePositionPopup.amount')}
              </Text>
            </View>
            <View style={styles.amountValueRow}>
              <View style={styles.amountValueContainer}>
                <Text style={styles.amountValue}>
                  ${splitNumberByStep(availableBalance.toFixed(2))}
                </Text>
                <Text style={styles.totalLabel}>
                  {t('page.perpsDetail.PerpsEditMarginPopup.available')}
                </Text>
              </View>
              <BottomSheetTextInput
                keyboardType="numeric"
                style={[
                  styles.input,
                  !marginValidation.isValid && Number(margin) > 0
                    ? styles.inputError
                    : null,
                ]}
                placeholderTextColor={colors2024['neutral-info']}
                placeholder="$0"
                value={Number(margin) > 0 ? displayedValue : ''}
                onChangeText={setMargin}
              />
            </View>
            <View style={styles.minimumWarningContainer}>
              {marginValidation.error ? (
                <Text style={styles.minimumWarning}>
                  {marginValidation.errorMessage}
                </Text>
              ) : null}
            </View>
            <PerpsSlider
              step={1}
              value={sliderPercentage}
              onValueChange={handleSliderChange}
              showPercentage={false}
            />
          </View>

          <View style={styles.listCard}>
            <View style={styles.sizeCard}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsAddPositionPopup.addSize')}
                </Text>
              </View>
              <View>
                <Text style={styles.value}>
                  {formatPerpsUsdValue(
                    Number(tradeSize) * markPrice,
                    BigNumber.ROUND_DOWN,
                  )}{' '}
                  = {tradeSize} {coin}
                </Text>
              </View>
            </View>
            <View style={styles.sizeCard}>
              <TouchableOpacity
                onPress={() => {
                  showTipsPopup({
                    title: t('page.perpsDetail.PerpsOpenPositionPopup.size'),
                    desc: t('page.perpsDetail.PerpsOpenPositionPopup.sizeTips'),
                  });
                }}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perpsDetail.PerpsAddPositionPopup.totalSize')}
                  </Text>
                  <RcIconInfoCC
                    width={18}
                    height={18}
                    color={colors2024['neutral-info']}
                  />
                </View>
              </TouchableOpacity>
              <View>
                <Text style={styles.value}>
                  {formatPerpsUsdValue(
                    Number(totalSize) * markPrice,
                    BigNumber.ROUND_DOWN,
                  )}{' '}
                  = {totalSize} {coin}
                </Text>
              </View>
            </View>
            <View style={styles.sizeCard}>
              <TouchableOpacity
                onPress={() => {
                  showTipsPopup({
                    title: t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.estLqPrice',
                    ),
                    desc: t(
                      'page.perpsDetail.PerpsOpenPositionCheckPopup.liquidationPriceTips',
                    ),
                  });
                }}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perpsDetail.PerpsEditMarginPopup.liqPrice')}
                  </Text>
                  <RcIconInfoCC
                    width={18}
                    height={18}
                    color={colors2024['neutral-info']}
                  />
                </View>
              </TouchableOpacity>
              <View>
                <Text style={styles.value}>
                  ${splitNumberByStep(Number(estimatedLiquidationPrice))}
                </Text>
              </View>
            </View>
          </View>
        </BottomSheetScrollView>
        <View style={styles.footer}>
          <Button
            type="primary"
            title={t('page.perpsDetail.PerpsClosePositionPopup.confirm')}
            loading={loading}
            disabled={!marginValidation.isValid}
            onPress={addPosition}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 48,
    },
    scrollViewContent: {
      paddingHorizontal: 20,
    },
    container: {
      height: '100%',
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 6,
      textAlign: 'center',
    },
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    coinNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    leverageTag: {
      borderRadius: 4,
      paddingHorizontal: 4,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    leverageText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    longText: {
      color: colors2024['green-default'],
    },
    shortText: {
      color: colors2024['red-default'],
    },
    card: {
      marginTop: 12,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      gap: 8,
      ...(isLight
        ? {
            // shadow: 0 10px 11.9px 0 rgba(0, 0, 0, 0.02)
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.02,
            shadowRadius: 11.9,
            // elevation: 3,
          }
        : null),
    },
    leftSection: {
      flexDirection: 'column',
      gap: 4,
      flex: 1,
    },
    coinInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    coinName: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    crossText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    crossTag: {
      borderRadius: 4,
      paddingHorizontal: 4,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
    },
    amountSection: {
      backgroundColor: colors2024['neutral-bg-2'],
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 20,
      paddingVertical: 16,
      paddingBottom: 6,
      paddingHorizontal: 20,
      marginTop: 12,
      marginBottom: 12,
    },
    amountHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    amountLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['brand-default'],
    },
    percentageText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 36,
      lineHeight: 42,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
    },
    input: {
      fontSize: 36,
      paddingVertical: 0,
      lineHeight: 42,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      flex: 1,
      textAlign: 'right',
      ...(!isAndroid && {
        fontFamily: 'SF Pro Rounded', // avoid some android phone show number not in center
      }),
      minWidth: 80,
    },
    inputError: {
      color: colors2024['red-default'],
    },
    amountValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    amountValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 42,
    },
    amountValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
    },
    totalLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-info'],
    },
    minimumWarning: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    minimumWarningContainer: {
      marginBottom: -4,
      // marginTop: -4,
      height: 14,
    },
    sizeCard: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      justifyContent: 'space-between',
    },
    value: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    listItemMain: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 20,
    },
    label: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    listCard: {
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      paddingHorizontal: 16,
      // paddingVertical: 16,
      flexDirection: 'column',
      // gap: 12,
      width: '100%',
      alignContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    rightSection: {
      alignItems: 'flex-end',
      gap: 4,
    },
    priceText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    pnlText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
    },
    pnlTextUp: {
      color: colors2024['green-default'],
    },
    pnlTextDown: {
      color: colors2024['red-default'],
    },
    pnlLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    pnlValue: {
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900',
    },
    red: {
      color: colors2024['red-default'],
    },
    green: {
      color: colors2024['green-default'],
    },
    feeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: 20,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});
