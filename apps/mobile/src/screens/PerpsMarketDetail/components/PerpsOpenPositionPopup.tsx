/* eslint-disable prettier/prettier */
/* eslint-disable react-native/no-inline-styles */
import { AppSwitch, AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { formatPerpsUsdValue, splitNumberByStep } from '@/utils/number';
import { calLiquidationPrice, formatPerpsPct } from '@/utils/perps';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { PerpsAutoCloseModal } from './PerpsAutoCloseModal';
import { PerpsOpenPositionCheckPopup } from './PerpsOpenPositionCheckPopup';
import { StepInput } from '@/components2024/StepInput';
import { PERPS_MAX_NTL_VALUE } from '@/constant/perps';
import BigNumber from 'bignumber.js';
import { useUsdInput } from '@/hooks/useUsdInput';
import { RcIconInfoFill1CC } from '@/assets/icons/common';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { Slider } from '@rneui/themed';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { BubbleWithText } from '@/screens/Swap/components/Slider';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { PerpEditTpSlPriceTag } from './PerpEditTpSlPriceTag';
const isAndroid = Platform.OS === 'android';

export const PerpsOpenPositionPopup: React.FC<{
  visible?: boolean;
  direction: 'Long' | 'Short';
  providerFee: number;
  coin: string;
  coinLogo?: string;
  markPrice: number;
  leverageRang: [number, number]; // [min, max]
  pxDecimals: number;
  szDecimals: number;
  maxNtlValue: number;
  availableBalance: number;
  onCancel: () => void;
  onConfirm: () => void;
  marketDataItem: MarketData;
  handleOpenPosition: (params: {
    coin: string;
    size: string;
    leverage: number;
    direction: 'Long' | 'Short';
    midPx: string;
    tpTriggerPx?: string;
    slTriggerPx?: string;
  }) => Promise<
    | {
        oid: number;
        avgPx: string;
        totalSz: string;
      }
    | undefined
  >;
}> = ({
  visible,
  direction: _direction,
  providerFee,
  coin,
  coinLogo,
  markPrice,
  leverageRang,
  pxDecimals,
  szDecimals,
  availableBalance,
  onCancel,
  onConfirm,
  handleOpenPosition,
  maxNtlValue,
  marketDataItem,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();
  const [_leveragePopupVisible, _setLeveragePopupVisible] =
    React.useState(false);
  const [isReviewMode, setIsReviewMode] = React.useState(false);
  const { showTipsPopup } = useTipsPopup();
  const [direction, setSelectedDirection] = React.useState<'Long' | 'Short'>(
    _direction,
  );
  const [autoCloseVisible, setAutoCloseVisible] = React.useState(false);
  // const [margin, setMargin] = React.useState<string>('');
  const {
    value: margin,
    displayedValue,
    onChangeText: setMargin,
  } = useUsdInput();
  const [selectedLeverage, setLeverage] = React.useState<number | undefined>(5);
  const leverage = selectedLeverage || 1;
  const [autoClose, setAutoClose] = React.useState({
    isOpen: false,
    tpTriggerPx: '',
    slTriggerPx: '',
  });
  const [tpTriggerPx, setTpTriggerPx] = React.useState<string>('');
  const [slTriggerPx, setSlTriggerPx] = React.useState<string>('');

  // Calculate slider percentage
  const sliderPercentage = React.useMemo(() => {
    const marginValue = Number(margin) || 0;
    if (marginValue === 0 || availableBalance === 0) {
      return 0;
    }
    return Math.min((marginValue / availableBalance) * 100, 100);
  }, [margin, availableBalance]);

  // 计算交易金额
  const tradeAmount = React.useMemo(() => {
    const marginValue = Number(margin) || 0;
    return marginValue * leverage;
  }, [margin, leverage]);

  // 计算交易数量
  const tradeSize = React.useMemo(() => {
    if (!markPrice || !tradeAmount) {
      return '0';
    }
    return Number(tradeAmount / markPrice).toFixed(szDecimals);
  }, [markPrice, tradeAmount, szDecimals]);

  // 计算预估清算价格
  const estimatedLiquidationPrice = React.useMemo(() => {
    if (!markPrice || !leverage) {
      return 0;
    }
    const maxLeverage = leverageRang[1];
    return calLiquidationPrice(
      markPrice,
      Number(margin),
      direction,
      Number(tradeSize),
      leverage,
      maxLeverage,
    ).toFixed(pxDecimals);
  }, [
    markPrice,
    leverage,
    leverageRang,
    margin,
    direction,
    tradeSize,
    pxDecimals,
  ]);

  const bothFee = React.useMemo(() => {
    return providerFee;
  }, [providerFee]);

  // 验证 margin 输入
  const marginValidation = React.useMemo(() => {
    const marginValue = Number(margin) || 0;
    const usdValue = marginValue * leverage;
    const sizeValue = Number(tradeSize) * markPrice;
    const maxValue = maxNtlValue || PERPS_MAX_NTL_VALUE;

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

    if (usdValue < 10 || sizeValue < 10) {
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
  }, [
    margin,
    leverage,
    tradeSize,
    markPrice,
    maxNtlValue,
    availableBalance,
    t,
  ]);

  const leverageRangeValidation = React.useMemo(() => {
    if (selectedLeverage == null || Number.isNaN(+selectedLeverage)) {
      return {
        error: true,
        errorMessage: t('page.perps.leverageRangeMinError', {
          min: leverageRang[0],
        }),
      };
    }
    if (selectedLeverage > leverageRang[1]) {
      return {
        error: true,
        errorMessage: t('page.perps.leverageRangeMaxError', {
          max: leverageRang[1],
        }),
      };
    }

    if (selectedLeverage < leverageRang[0]) {
      return {
        error: true,
        errorMessage: t('page.perps.leverageRangeMinError', {
          min: leverageRang[0],
        }),
      };
    }
    return { error: false, errorMessage: '' };
  }, [selectedLeverage, leverageRang, t]);

  React.useEffect(() => {
    if (!visible) {
      setMargin('');
      setLeverage(Math.min(leverageRang[1], 5));
      setAutoClose({
        isOpen: false,
        tpTriggerPx: '',
        slTriggerPx: '',
      });
      _setLeveragePopupVisible(false);
      setIsReviewMode(false);
    }
  }, [visible, leverageRang, setMargin]);

  useEffect(() => {
    setSelectedDirection(_direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const openPosition = useMemoizedFn(async () => {
    await handleOpenPosition({
      coin,
      size: tradeSize,
      leverage,
      direction,
      midPx: markPrice.toString(),
      tpTriggerPx:
        autoClose.isOpen && autoClose.tpTriggerPx
          ? autoClose.tpTriggerPx
          : undefined,
      slTriggerPx:
        autoClose.isOpen && autoClose.slTriggerPx
          ? autoClose.slTriggerPx
          : undefined,
    });
    onConfirm();
  });

  // Handle slider change
  const handleSliderChange = useMemoizedFn((value: number) => {
    const newMargin = (availableBalance * value) / 100;
    setMargin(
      new BigNumber(newMargin).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed(),
    );
  });

  const handleAutoCloseSwitch = useMemoizedFn((e: boolean) => {
    if (e) {
      setAutoCloseVisible(true);
    } else {
      setAutoClose({
        isOpen: false,
        tpTriggerPx: '',
        slTriggerPx: '',
      });
    }
  });

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 100;
  }, [height]);

  const isUp =
    Number(marketDataItem.markPx) - Number(marketDataItem.prevDayPx) > 0;
  const absPnlUsd = Math.abs(
    Number(marketDataItem.markPx) - Number(marketDataItem.prevDayPx),
  );
  const absPnlPct = Math.abs(absPnlUsd / Number(marketDataItem.prevDayPx));
  const pnlText = `${isUp ? '+' : '-'}${formatPerpsPct(absPnlPct)}`;

  const showBubble = useSharedValue(false);

  const { width } = useWindowDimensions();

  const sliderStyle = useAnimatedStyle(
    () => ({
      opacity: showBubble.value ? 1 : 0,
      display: showBubble.value ? 'flex' : 'none',
      position: 'absolute',
      top: isAndroid ? -72 : -60,
      left: 0,
      height: 70,
      width,
      transform: [
        {
          translateX: 0 - width / 2 + (isAndroid ? 7 : 6),
        },
      ],
    }),
    [width],
  );

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
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
            contentContainerStyle={styles.scrollViewContent}>
            <View>
              <Text style={styles.title}>
                {t('page.perpsDetail.PerpsOpenPositionPopup.title', {
                  defaultValue: 'Open Position',
                })}
              </Text>
            </View>

            {/* Long/Short Toggle */}
            <View style={styles.directionToggle}>
              <TouchableOpacity
                style={[
                  styles.directionButton,
                  styles.directionButtonLeft,
                  direction === 'Long' && {
                    backgroundColor: colors2024['green-light-4'],
                    borderRadius: 8,
                  },
                ]}
                onPress={() => setSelectedDirection('Long')}>
                <Text
                  style={[
                    styles.directionButtonText,
                    direction === 'Long' && {
                      color: colors2024['green-default'],
                    },
                  ]}>
                  {t('page.perpsDetail.action.long')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.directionButton,
                  styles.directionButtonRight,
                  direction === 'Short' && {
                    backgroundColor: colors2024['red-light-1'],
                    borderRadius: 8,
                  },
                ]}
                onPress={() => setSelectedDirection('Short')}>
                <Text
                  style={[
                    styles.directionButtonText,
                    direction === 'Short' && {
                      color: colors2024['red-default'],
                    },
                  ]}>
                  {t('page.perpsDetail.action.short')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Coin Info */}
            <View style={styles.card}>
              <AssetAvatar
                logo={marketDataItem.logoUrl}
                logoStyle={styles.icon}
                size={46}
              />
              <View style={styles.content}>
                <View style={styles.row}>
                  <View style={styles.nameContainer}>
                    <Text style={styles.name}>{marketDataItem.name}</Text>
                  </View>
                  <Text style={styles.price}>
                    {' '}
                    {`$${marketDataItem.markPx}`}
                  </Text>
                </View>
                <View style={styles.row}>
                  <View style={styles.infoContainer}>
                    <Text style={styles.volText}>
                      {marketDataItem.maxLeverage}x
                    </Text>
                    <Text style={styles.volText}>|</Text>
                    <Text style={styles.volText}>
                      VOL: {formatUsdValueKMB(marketDataItem.dayNtlVlm || 0)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.priceChange,
                      isUp ? null : styles.priceChangeDown,
                    ]}>
                    {pnlText}
                  </Text>
                </View>
              </View>
            </View>

            {/* Margin Section */}
            <View style={styles.marginSection}>
              <Text style={styles.marginLabel}>
                {t('page.perpsDetail.PerpsOpenPositionPopup.margin')}
              </Text>

              {/* Input Field */}
              <BottomSheetTextInput
                keyboardType="numeric"
                style={[
                  styles.input,
                  !marginValidation.isValid && margin !== ''
                    ? styles.inputError
                    : null,
                ]}
                placeholder="$0"
                value={displayedValue}
                onChangeText={setMargin}
              />

              {marginValidation.error ? (
                <View style={styles.marginAvailableWrapper}>
                  <Text style={styles.errorMsg}>
                    {marginValidation.errorMessage}
                  </Text>
                </View>
              ) : (
                <View style={styles.marginAvailableWrapper}>
                  <Text style={styles.marginAvailable}>
                    {formatPerpsUsdValue(
                      availableBalance,
                      BigNumber.ROUND_DOWN,
                    )}{' '}
                    {t('page.perpsDetail.PerpsOpenPositionPopup.available')}
                  </Text>
                </View>
              )}

              {/* Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderWrapper}>
                  <Slider
                    value={sliderPercentage}
                    onValueChange={handleSliderChange}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    trackStyle={styles.sliderTrack}
                    minimumTrackTintColor={colors2024['brand-default']}
                    maximumTrackTintColor={colors2024['neutral-line']}
                    thumbStyle={styles.thumbStyle}
                    thumbProps={{
                      children: (
                        <View>
                          <View
                            style={[
                              styles.outerThumb,
                              { position: 'relative' },
                            ]}>
                            <View style={styles.innerThumb} />

                            <Animated.View style={sliderStyle}>
                              <BubbleWithText slide={sliderPercentage || 0} />
                            </Animated.View>
                          </View>
                        </View>
                      ),
                    }}
                  />
                </View>
                <Text style={styles.sliderPercentage}>
                  {sliderPercentage.toFixed(0)}%
                </Text>
              </View>
            </View>
            <View style={styles.list}>
              <View style={[styles.listItem, styles.stepInputContainer]}>
                <View style={styles.listItemMain}>
                  <Text
                    style={[
                      styles.label,
                      leverageRangeValidation.errorMessage
                        ? styles.hasError
                        : null,
                    ]}>
                    {t('page.perpsDetail.PerpsOpenPositionPopup.leverage')}
                    <Text
                      style={[
                        styles.labelInfo,
                        leverageRangeValidation.errorMessage
                          ? styles.hasError
                          : null,
                      ]}>
                      （{leverageRang[0]}-{leverageRang[1]}x）
                    </Text>
                  </Text>
                </View>
                <View>
                  <StepInput
                    suffix="x"
                    value={selectedLeverage}
                    onChange={setLeverage}
                    step={1}
                    inputStyle={
                      leverageRangeValidation.error ? styles.hasError : null
                    }
                    min={leverageRang[0]}
                    max={leverageRang[1]}
                    as="BottomSheetTextInput"
                  />
                </View>
              </View>
              <View style={styles.listItem}>
                <TouchableOpacity
                  onPress={() => {
                    showTipsPopup({
                      title: t('page.perpsDetail.PerpsOpenPositionPopup.size'),
                      desc: t(
                        'page.perpsDetail.PerpsOpenPositionPopup.sizeTips',
                      ),
                    });
                  }}>
                  <View style={styles.listItemMain}>
                    <Text style={styles.label}>
                      {t('page.perpsDetail.PerpsOpenPositionPopup.size')}
                    </Text>
                    <RcIconInfoFill1CC
                      width={15}
                      height={15}
                      color={colors2024['neutral-info']}
                    />
                  </View>
                </TouchableOpacity>
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
              <View style={styles.listItem}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsOpenPositionPopup.takeProfitWhen')}
                </Text>
                <PerpEditTpSlPriceTag
                  coin={coin}
                  actionType="tp"
                  type="openPosition"
                  markPrice={markPrice}
                  direction={direction}
                  size={Number(tradeSize)}
                  liqPrice={Number(estimatedLiquidationPrice)}
                  pxDecimals={pxDecimals}
                  szDecimals={szDecimals}
                  handleSetAutoClose={async (price: string) => {
                    setTpTriggerPx(price);
                  }}
                />
              </View>
              <View style={styles.listItem}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsOpenPositionPopup.stopLossWhen')}
                </Text>
                <PerpEditTpSlPriceTag
                  coin={coin}
                  actionType="sl"
                  type="openPosition"
                  markPrice={markPrice}
                  direction={direction}
                  size={Number(tradeSize)}
                  liqPrice={Number(estimatedLiquidationPrice)}
                  pxDecimals={pxDecimals}
                  szDecimals={szDecimals}
                  handleSetAutoClose={async (price: string) => {
                    setSlTriggerPx(price);
                  }}
                />
              </View>
            </View>
          </BottomSheetScrollView>
          <View style={styles.footer}>
            <Button
              type="primary"
              title={t('global.check')}
              disabled={
                !marginValidation.isValid || leverageRangeValidation.error
              }
              onPress={() => {
                setIsReviewMode(true);
              }}
            />
          </View>
        </AutoLockView>
      </AppBottomSheetModal>
      <PerpsOpenPositionCheckPopup
        info={{
          coin: coin,
          margin,
          direction,
          leverage,
          tradeAmount,
          tradeSize,
          markPrice,
          providerFee,
          bothFee,
          autoClose,
          estimatedLiquidationPrice,
          coinLogo,
        }}
        visible={isReviewMode}
        onClose={() => {
          setIsReviewMode(false);
        }}
        onConfirm={openPosition}
      />
      {autoCloseVisible ? (
        <PerpsAutoCloseModal
          visible={autoCloseVisible}
          coin={coin}
          type="openPosition"
          price={markPrice}
          liqPrice={Number(estimatedLiquidationPrice)}
          direction={direction}
          size={Number(tradeSize)}
          pxDecimals={pxDecimals}
          szDecimals={szDecimals}
          onClose={() => setAutoCloseVisible(false)}
          handleSetAutoClose={async (params: {
            tpPrice: string;
            slPrice: string;
          }) => {
            setAutoClose({
              isOpen: true,
              tpTriggerPx: params.tpPrice,
              slTriggerPx: params.slPrice,
            });
            setAutoCloseVisible(false);
          }}
        />
      ) : null}
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
      minHeight: 18,
    },
    errorMsg: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    input: {
      // fontFamily: 'SF Pro Rounded',
      fontSize: 40,
      paddingVertical: 0,
      lineHeight: 48,
      fontWeight: '800',
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
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 56,
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
      fontWeight: '700',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
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
    coinInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      borderRadius: 12,
      marginBottom: 16,
    },
    coinInfoLeft: {
      flex: 1,
    },
    coinInfoRight: {
      alignItems: 'flex-end',
    },
    coinName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 4,
    },
    coinDetail: {
      fontSize: 14,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
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
      borderRadius: 16,
      marginBottom: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    marginLabel: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      marginBottom: 4,
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'center',
    },
    marginAvailableWrapper: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    marginAvailable: {
      fontSize: 16,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    sliderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: 8,
      gap: 8,
    },
    sliderWrapper: {
      flex: 1,
    },
    sliderThumb: {
      width: 20,
      height: 20,
      backgroundColor: colors2024['brand-default'],
      borderRadius: 10,
    },
    sliderTrack: {
      height: 4,
      borderRadius: 2,
    },
    sliderPercentage: {
      fontSize: 14,
      fontWeight: '600',
      color: colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
      minWidth: 40,
      textAlign: 'right',
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
    card: {
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
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
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
