import { AssetAvatar, Tip } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import RcIconTipsLightCC from '@/assets2024/icons/perps/IconTipsLightCC.svg';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import {
  formatPerpsUsdValue,
  formatUsdValue,
  splitNumberByStep,
} from '@/utils/number';
import {
  calLiquidationPrice,
  calTransferMarginRequired,
  formatPerpsPct,
  MAX_SIGNIFICANT_FIGURES,
} from '@/utils/perps';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
const isAndroid = Platform.OS === 'android';
import BigNumber from 'bignumber.js';
import { useUsdInput } from '@/hooks/useUsdInput';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { PerpsSlider } from './PerpsSlider';
import { DistanceToLiquidationTag } from '@/screens/Perps/components/PerpsPositionSection/DistanceToLiquidationTag';
import { toast } from '@/components/Toast';
import { IS_IOS } from '@/core/native/utils';
import { AssetPriceInfo } from './PerpsPriceInfo';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { calculateDistanceToLiquidation } from '@/screens/Perps/components/PerpsPositionSection/utils';
import { showToast } from '@/hooks/perps/showToast';

export const PerpsEditMarginPopup: React.FC<{
  visible: boolean;
  direction: 'Long' | 'Short';
  coin: string;
  coinLogo?: string;
  markPrice: number;
  entryPrice: number;
  leverage: number;
  leverageMax: number;
  pxDecimals: number;
  szDecimals: number;
  availableBalance: number;
  liquidationPx: number;
  positionSize: number;
  marginUsed: number;
  pnlPercent: number;
  pnl: number;
  marginMode: 'cross' | 'isolated';
  activeAssetCtx: WsActiveAssetCtx['ctx'] | null;
  currentAssetCtx: MarketData | null;
  handlePressRiskTag: () => void;
  onCancel: () => void;
  onConfirm: (action: 'add' | 'reduce', margin: number) => Promise<void>;
}> = ({
  visible,
  direction,
  coin,
  coinLogo,
  markPrice,
  leverage,
  leverageMax,
  pxDecimals,
  entryPrice,
  szDecimals,
  availableBalance,
  onCancel,
  onConfirm,
  liquidationPx,
  positionSize,
  marginUsed,
  marginMode,
  activeAssetCtx,
  currentAssetCtx,
  pnlPercent,
  pnl,
  handlePressRiskTag,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const scrollViewRef = useRef<BottomSheetScrollViewMethods>(null);

  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const {
    value: margin,
    displayedValue,
    onChangeText: setMargin,
  } = useUsdInput();

  const marginNormalized = useMemo(() => {
    const newMargin = margin.startsWith('$') ? margin.slice(1) : margin;
    return Number(newMargin);
  }, [margin]);

  const noChangeMargin = useMemo(() => {
    return marginNormalized.toFixed(2) === marginUsed.toFixed(2);
  }, [marginNormalized, marginUsed]);

  // 计算预估清算价格
  const estimatedLiquidationPrice = React.useMemo(() => {
    if (!margin || margin === '0' || noChangeMargin) {
      return '';
    }
    const marginNormalized = margin.startsWith('$') ? margin.slice(1) : margin;
    const newMargin = Number(marginNormalized);
    const nationalValue = Number(positionSize) * Number(markPrice);
    return calLiquidationPrice(
      markPrice,
      newMargin,
      direction,
      Number(positionSize),
      nationalValue,
      leverageMax,
    ).toFixed(pxDecimals);
  }, [
    markPrice,
    leverageMax,
    margin,
    direction,
    positionSize,
    pxDecimals,
    noChangeMargin,
  ]);

  const minMargin = useMemo(() => {
    const requiredMargin = calTransferMarginRequired(
      markPrice,
      positionSize,
      leverage,
    );
    return new BigNumber(Math.min(requiredMargin + 0.1, marginUsed))
      .decimalPlaces(2, BigNumber.ROUND_UP)
      .toNumber();
  }, [markPrice, positionSize, leverage, marginUsed]);

  const maxMargin = useMemo(() => {
    const noHaveBalance = availableBalance < 0.01;
    const max = noHaveBalance ? marginUsed : availableBalance + marginUsed;
    return new BigNumber(max).decimalPlaces(2, BigNumber.ROUND_DOWN).toNumber();
  }, [availableBalance, marginUsed]);

  const availableToReduce = useMemo(() => {
    // transfer_margin_required = max(initial_margin_required, 0.1 * total_position_value)
    const transferMarginRequired = calTransferMarginRequired(
      markPrice,
      positionSize,
      leverage,
    );
    return Math.max(marginUsed - transferMarginRequired, 0);
  }, [markPrice, positionSize, leverage, marginUsed]);

  // 验证 margin 输入
  const marginValidation = React.useMemo(() => {
    const marginValue = Number(margin) || 0;

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

    if (marginValue < minMargin) {
      return {
        isValid: false,
        error: 'invalid_margin',
        errorMessage: t('page.perpsDetail.PerpsOpenPositionPopup.minMargin', {
          amount: `$${minMargin}`,
        }),
      };
    }

    if (marginValue > maxMargin) {
      return {
        isValid: false,
        error: 'invalid_margin',
        errorMessage: t('page.perpsDetail.PerpsOpenPositionPopup.maxMargin', {
          amount: `$${maxMargin}`,
        }),
      };
    }

    return { isValid: true, error: null };
  }, [margin, t, minMargin, maxMargin]);

  React.useEffect(() => {
    if (visible) {
      setMargin(marginUsed.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canReduce = useMemo(() => {
    return availableToReduce > 0.01;
  }, [availableToReduce]);

  // Handle slider change
  const handleSliderChange = useMemoizedFn((value: number) => {
    setMargin(value.toFixed(2));
  });

  // Handle input focus - scroll to bottom
  const handleInputFocus = useMemoizedFn(() => {
    if (IS_IOS) {
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: false }),
        350,
      );
    } else {
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        200,
      );
    }
  });

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return Math.min(height - 100, 610);
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const {
    runAsync: handleConfirm,
    cancel,
    loading,
  } = useRequest(
    async () => {
      const action = Number(margin) > marginUsed ? 'add' : 'reduce';
      const marginDiff = Math.abs(Number(margin) - marginUsed);
      await onConfirm(action, marginDiff);
    },
    {
      manual: true,
      onError(error: any) {
        console.error('Failed to update margin:', error);
        toast.error(error?.message || 'Failed to update margin');
      },
      onSuccess() {
        onCancel();
      },
    },
  );

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onCancel}
        snapPoints={[maxHeight]}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        <AutoLockView style={[styles.container]}>
          <BottomSheetScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollViewContent}>
            <View>
              <Text style={styles.title}>
                {t('page.perpsDetail.PerpsEditMarginPopup.title')}
              </Text>
            </View>
            <View>
              <AssetPriceInfo
                coin={coin}
                logoUrl={coinLogo!}
                activeAssetCtx={activeAssetCtx}
                currentAssetCtx={currentAssetCtx}
              />
            </View>
            {/* <View style={styles.directionToggle}>
              <TouchableOpacity
                style={[
                  styles.directionButton,
                  styles.directionButtonLeft,
                  action === 'add' && {
                    backgroundColor: colors2024['brand-light-1'],
                    borderRadius: 8,
                  },
                ]}
                onPress={() => {
                  setAction('add');
                  setMargin('');
                }}>
                <Text
                  style={[
                    styles.directionButtonText,
                    action === 'add' && {
                      color: colors2024['brand-default'],
                      fontWeight: '700',
                    },
                  ]}>
                  {t('page.perpsDetail.PerpsEditMarginPopup.addMargin')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.directionButton,
                  styles.directionButtonRight,
                  action === 'reduce' && {
                    backgroundColor: colors2024['brand-light-1'],
                    borderRadius: 8,
                  },
                ]}
                onPress={() => {
                  setAction('reduce');
                  setMargin('');
                }}>
                <Text
                  style={[
                    styles.directionButtonText,
                    action === 'reduce' && {
                      color: colors2024['brand-default'],
                      fontWeight: '700',
                    },
                  ]}>
                  {t('page.perpsDetail.PerpsEditMarginPopup.reduceMargin')}
                </Text>
              </TouchableOpacity>
            </View> */}

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
                        direction === 'Long'
                          ? styles.longText
                          : styles.shortText,
                      ]}>
                      {direction} {`${leverage}x`}
                    </Text>
                  </View>
                  {/* <DistanceToLiquidationTag
                    liquidationPrice={liquidationPx}
                    markPrice={markPrice}
                    onPress={handlePressRiskTag}
                  /> */}
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

            {/* Margin Section */}
            <View style={styles.marginSection}>
              <Text style={styles.marginLabel}>
                {t('page.perpsDetail.PerpsOpenPositionPopup.margin')}
              </Text>

              <View style={styles.marginInputWrapper}>
                <TouchableOpacity
                  onPress={() => setMargin(minMargin.toString())}
                  style={styles.marginBtn}>
                  <Text style={styles.marginBtnText}>Min</Text>
                </TouchableOpacity>
                <BottomSheetTextInput
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    !marginValidation.isValid && Number(margin) > 0
                      ? styles.inputError
                      : null,
                  ]}
                  placeholder={`$${marginUsed.toFixed(2)}`}
                  placeholderTextColor={colors2024['neutral-info']}
                  value={Number(margin) > 0 ? displayedValue : ''}
                  onChangeText={setMargin}
                  onFocus={handleInputFocus}
                />
                <TouchableOpacity
                  onPress={() => setMargin(maxMargin.toString())}
                  style={styles.marginBtn}>
                  <Text style={styles.marginBtnText}>MAX</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.marginAvailableWrapper}>
                <Text style={styles.marginAvailable}>
                  {formatPerpsUsdValue(Number(minMargin), BigNumber.ROUND_DOWN)}
                </Text>
                <View style={styles.errorMsgContainer}>
                  {marginValidation.error ? (
                    <Text style={styles.errorMsg}>
                      {marginValidation.errorMessage}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.marginAvailable}>
                  {formatPerpsUsdValue(maxMargin, BigNumber.ROUND_DOWN)}
                </Text>
              </View>
              {/*
              {marginValidation.error ? (
                <View style={styles.marginAvailableWrapper}>
                  <Text style={styles.errorMsg}>
                    {marginValidation.errorMessage}
                  </Text>
                </View>
              ) : (
                <View style={styles.marginAvailableWrapper}>
                  {action === 'add' ? (
                    <Text style={styles.marginAvailable}>
                      {t('page.perpsDetail.PerpsEditMarginPopup.perpsBalance')}
                      {': '}
                      {formatPerpsUsdValue(
                        availableBalance,
                        BigNumber.ROUND_DOWN,
                      )}
                    </Text>
                  ) : (
                    <Text style={styles.marginAvailable}>
                      {t('page.perpsDetail.PerpsEditMarginPopup.available')}
                      {': '}
                      {formatPerpsUsdValue(
                        availableToReduce,
                        BigNumber.ROUND_DOWN,
                      )}
                    </Text>
                  )}
                </View>
              )} */}
              <PerpsSlider
                disabled={maxMargin <= minMargin}
                maxValue={maxMargin}
                step={0.1}
                minValue={Number(minMargin)}
                value={marginNormalized}
                onValueChange={handleSliderChange}
                showPercentage={false}
              />
            </View>
            <View style={styles.priceContainer}>
              <View style={styles.liqPriceRow}>
                <Text style={styles.liqPrice}>
                  {t('page.perpsDetail.PerpsEditMarginPopup.liqPrice')}
                </Text>
                <View style={styles.rowItem}>
                  <Text style={styles.liqPriceAmount}>
                    {`$${splitNumberByStep(Number(liquidationPx))}`}
                  </Text>
                  {margin && estimatedLiquidationPrice && (
                    <Text style={styles.liqPriceAmount}>
                      {`→ $${splitNumberByStep(
                        Number(estimatedLiquidationPrice),
                      )}`}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.liqPriceRow}>
                <TouchableOpacity
                  style={styles.rowItem}
                  onPress={() => {
                    handlePressRiskTag?.();
                  }}>
                  <Text style={styles.liqPrice}>
                    {t('page.perpsDetail.PerpsEditMarginPopup.liqDistance')}
                  </Text>
                  <RcIconInfoCC
                    width={15}
                    height={15}
                    color={colors2024['neutral-info']}
                  />
                </TouchableOpacity>
                <View style={styles.rowItem}>
                  <RcIconTipsLightCC
                    width={20}
                    height={20}
                    color={colors2024['neutral-info']}
                  />
                  <Text style={styles.liqPriceAmount}>
                    {formatPerpsPct(
                      calculateDistanceToLiquidation(liquidationPx, markPrice),
                    )}
                  </Text>
                  {margin && estimatedLiquidationPrice && (
                    <Text style={styles.liqPriceAmount}>
                      {`→ ${formatPerpsPct(
                        calculateDistanceToLiquidation(
                          estimatedLiquidationPrice,
                          markPrice,
                        ),
                      )}`}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </BottomSheetScrollView>
          <View style={styles.footer}>
            <Button
              type="primary"
              title={t('global.confirm')}
              loading={loading}
              disabled={!marginValidation.isValid || noChangeMargin}
              onPress={handleConfirm}
            />
          </View>
        </AutoLockView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      height: '100%',
      // paddingBottom: 56,
      // minHeight: 544,
    },
    scrollViewContent: {
      paddingHorizontal: 20,
    },
    formItem: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      minHeight: 156,

      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,

      marginBottom: 18,
    },
    formItemLabel: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'center',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    errorMsgContainer: {
      flex: 1,
      alignItems: 'center',
    },
    errorMsg: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    marginInputWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: -6,
    },
    input: {
      // fontFamily: 'SF Pro Rounded',
      fontSize: 40,
      paddingVertical: 0,
      lineHeight: 48,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      flex: 1,
      textAlign: 'center',
      ...(!isAndroid && {
        fontFamily: 'SF Pro Rounded', // avoid some android phone show number not in center
      }),
      minWidth: 80,
    },
    inputError: {
      color: colors2024['red-default'],
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
    currentPriceTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      marginBottom: 16,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    },
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 48,
    },
    liqPrice: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
    },
    liqPriceAmount: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    priceContainer: {
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      borderRadius: 16,
      marginBottom: 8,
    },
    liqPriceRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 16,
      justifyContent: 'space-between',
    },
    rowItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    row: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    name: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    nameContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    volText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
    },
    price: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    list: {
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      marginBottom: 18,
    },
    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      justifyContent: 'space-between',
    },
    listItemRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listSub: {
      padding: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 6,
      marginTop: 12,
    },
    listSubItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
    },
    listSubItemLabel: {
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
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
    labelInfo: {
      color: colors2024['neutral-info'],
    },
    value: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },

    stepInputContainer: {
      // display: 'flex',
      // flexDirection: 'column',
      // gap: 2,
      // alignItems: 'flex-end',
      position: 'relative',
    },
    stepInputError: {
      position: 'absolute',
      bottom: -2,
      right: 0,
      left: 0,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingRight: 16,
      // backgroundColor: 'red',
    },
    hasError: {
      color: colors2024['red-default'],
    },
    availableBalanceWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    maxButtonWrapper: {
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

    // New styles for redesigned UI
    directionToggle: {
      padding: 4,
      flexDirection: 'row',
      marginBottom: 16,
      borderRadius: 8,
      height: 42,
      overflow: 'hidden',
      backgroundColor: colors2024['neutral-bg-2'],
    },
    directionButton: {
      flex: 1,
      // paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['neutral-bg-2'],
    },
    directionButtonLeft: {
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
    },
    directionButtonRight: {
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
    },
    directionButtonText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    coinInfoLeft: {
      flex: 1,
    },
    coinInfoRight: {
      alignItems: 'flex-end',
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
    coinDetail: {
      fontSize: 14,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
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
    coinPrice: {
      fontSize: 18,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 4,
    },
    coinChange: {
      fontSize: 14,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
    },
    coinChangePositive: {
      color: colors2024['green-default'],
    },
    coinChangeNegative: {
      color: colors2024['red-default'],
    },
    marginSection: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 20,
      paddingBottom: 6,
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'column',
      // alignItems: 'center',
    },
    marginBtn: {
      padding: 4,
      backgroundColor: colors2024['brand-light-1'],
      borderRadius: 8,
    },
    marginBtnText: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
    },
    marginLabel: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
      // marginBottom: 4,
      color: colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
    },
    marginAvailableWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: -12,
      gap: 4,
    },
    marginAvailable: {
      fontSize: 16,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    leverageContainer: {
      backgroundColor: colors2024['neutral-bg-5'],
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    leverage: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
    },
    priceChange: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['green-default'],
    },
    priceChangeDown: {
      color: colors2024['red-default'],
    },
    mainContent: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'space-between',
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
      marginTop: 16,
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
      marginBottom: 16,
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
    icon: {
      width: 46,
      height: 46,
      borderRadius: 1000,
      flexShrink: 0,
    },
    infoContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
  };
});
