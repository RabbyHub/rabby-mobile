import { AppSwitch } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import {
  formatPerpsUsdValue,
  formatUsdValue,
  splitNumberByStep,
} from '@/utils/number';
import { calLiquidationPrice } from '@/utils/perps';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, useWindowDimensions, View } from 'react-native';
import { PerpsAutoCloseModal } from './PerpsAutoCloseModal';
import { PerpsOpenPositionCheckPopup } from './PerpsOpenPositionCheckPopup';
import { StepInput } from '@/components2024/StepInput';
import { PERPS_MAX_NTL_VALUE } from '@/constant/perps';
import BigNumber from 'bignumber.js';
import { useUsdInput } from '@/hooks/useUsdInput';

export const PerpsOpenPositionPopup: React.FC<{
  visible?: boolean;
  direction: 'Long' | 'Short';
  providerFee: number;
  coin: string;
  markPrice: number;
  leverageRang: [number, number]; // [min, max]
  pxDecimals: number;
  szDecimals: number;
  maxNtlValue: number;
  availableBalance: number;
  onCancel: () => void;
  onConfirm: () => void;
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
  direction,
  providerFee,
  coin,
  markPrice,
  leverageRang,
  pxDecimals,
  szDecimals,
  availableBalance,
  onCancel,
  onConfirm,
  handleOpenPosition,
  maxNtlValue,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();
  const [leveragePopupVisible, setLeveragePopupVisible] = React.useState(false);
  const [isReviewMode, setIsReviewMode] = React.useState(false);

  const openLeveragePopup = () => {
    setLeveragePopupVisible(true);
  };
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
  const [loading, setLoading] = React.useState<boolean>(false);

  // 计算交易金额
  const tradeAmount = React.useMemo(() => {
    const marginValue = Number(margin) || 0;
    return marginValue * leverage;
  }, [margin, leverage]);

  // 计算交易数量
  const tradeSize = React.useMemo(() => {
    if (!markPrice || !tradeAmount) return '0';
    return Number(tradeAmount / markPrice).toFixed(szDecimals);
  }, [markPrice, tradeAmount, szDecimals]);

  // 计算预估清算价格
  const estimatedLiquidationPrice = React.useMemo(() => {
    if (!markPrice || !leverage) return 0;
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
    return providerFee + 0.0005;
  }, [providerFee]);

  // 验证 margin 输入
  const marginValidation = React.useMemo(() => {
    const marginValue = Number(margin);
    const usdValue = marginValue * leverage;
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

    if (usdValue < 10) {
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
  }, [margin, availableBalance, t, leverage, maxNtlValue]);

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
      setLeveragePopupVisible(false);
      setIsReviewMode(false);
    }
  }, [visible, leverageRang, setMargin]);

  const openPosition = useMemoizedFn(async () => {
    setLoading(true);
    const res = await handleOpenPosition({
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
    setLoading(false);
    onConfirm();
    // return res;
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
    return height - 200;
  }, [height]);

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
          linearGradientType: isLight ? 'bg2' : 'bg1',
        })}
        onDismiss={onCancel}
        enableDynamicSizing
        maxDynamicContentSize={maxHeight}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        <BottomSheetScrollView>
          <AutoLockView style={[styles.container]}>
            <View>
              <Text style={styles.title}>
                {direction} {coin}-USD
              </Text>
            </View>
            <View style={styles.formItem}>
              <Text style={styles.formItemLabel}>
                {t('page.perpsDetail.PerpsOpenPositionPopup.margin')}
              </Text>

              <BottomSheetTextInput
                keyboardType="numeric"
                style={[
                  styles.input,
                  !marginValidation.isValid ? styles.inputError : null,
                ]}
                placeholder="$0"
                value={displayedValue}
                onChangeText={setMargin}
              />
              <Text style={styles.formItemDesc}>
                {formatUsdValue(availableBalance)}{' '}
                {t('page.perpsDetail.PerpsOpenPositionPopup.available')}
              </Text>
              <View style={styles.errorMsgContainer}>
                {marginValidation.error ? (
                  <Text style={styles.errorMsg}>
                    {marginValidation.errorMessage}
                  </Text>
                ) : null}
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
                {/* {leverageRangeValidation.errorMessage ? (
                  <View style={styles.stepInputError}>
                    <Text style={[styles.errorMsg]}>
                      {leverageRangeValidation.errorMessage}
                    </Text>
                  </View>
                ) : null} */}
              </View>

              <View style={styles.listItem}>
                <View style={styles.listItemMain}>
                  <Text style={styles.label}>
                    {t('page.perpsDetail.PerpsOpenPositionPopup.size')}
                  </Text>
                  {/* <RcIconInfoFillCC
                    width={15}
                    height={15}
                    color={colors2024['neutral-info']}
                  /> */}
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
              <View style={styles.listItemContainer}>
                <View style={styles.listItemRow}>
                  <View style={styles.listItemMain}>
                    <Text style={styles.label}>
                      {t('page.perpsDetail.PerpsOpenPositionPopup.autoClose')}
                    </Text>
                  </View>
                  <View>
                    <AppSwitch
                      value={autoClose.isOpen}
                      circleSize={20}
                      circleBorderWidth={2}
                      onValueChange={handleAutoCloseSwitch}
                    />
                  </View>
                </View>
                {autoClose.isOpen ? (
                  <View style={styles.listSub}>
                    <View style={styles.listSubItem}>
                      <Text style={styles.listSubItemLabel}>
                        {t('page.perpsDetail.PerpsOpenPositionPopup.tpPrice')}
                      </Text>
                      <Text style={styles.value}>
                        ${splitNumberByStep(autoClose.tpTriggerPx || 0)}
                      </Text>
                      {/* <RcArrowRight2CC
                        width={16}
                        height={16}
                        color={colors2024['neutral-body']}
                      /> */}
                    </View>
                    <View style={styles.listSubItem}>
                      <Text style={styles.listSubItemLabel}>
                        {t('page.perpsDetail.PerpsOpenPositionPopup.slPrice')}
                      </Text>
                      <Text style={styles.value}>
                        ${splitNumberByStep(autoClose.slTriggerPx || 0)}
                      </Text>
                      {/* <RcArrowRight2CC
                        width={16}
                        height={16}
                        color={colors2024['neutral-body']}
                      /> */}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
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
          </AutoLockView>
        </BottomSheetScrollView>
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
          pxDecimals={szDecimals}
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
      paddingBottom: 56,
      paddingHorizontal: 20,
      // minHeight: 544,
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
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['red-default'],
    },
    input: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 40,
      lineHeight: 48,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      flex: 1,
      textAlign: 'center',
    },
    inputError: {
      borderColor: colors2024['red-default'],
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
    list: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      marginBottom: 18,
    },
    listItemContainer: {
      padding: 16,
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
  };
});
