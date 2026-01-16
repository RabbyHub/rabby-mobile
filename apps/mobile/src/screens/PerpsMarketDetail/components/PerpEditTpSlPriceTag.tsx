import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn, useRequest } from 'ahooks';
import IconPerpEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import IconPerpDelete from '@/assets2024/icons/perps/IconTagClearCC.svg';
import { toast } from '@/components2024/Toast';
import { useSlTpUsdInput } from '@/hooks/useUsdInput';
import { formatPerpsPct, formatTpOrSlPrice } from '@/utils/perps';
import RcIconCloseCC from '@/assets2024/icons/perps/IconCloseCC.svg';

interface Props {
  coin: string;
  handleActionApproveStatus?: () => Promise<void>;
  entryPrice?: number;
  markPrice: number;
  initTpOrSlPrice: string;
  direction: 'Long' | 'Short';
  size: number;
  margin: number;
  leverage: number;
  liqPrice: number;
  pxDecimals: number;
  szDecimals: number;
  actionType: 'tp' | 'sl';
  type: 'openPosition' | 'hasPosition';
  handleSetAutoClose: (price: string) => Promise<void>;
  handleCancelAutoClose: () => Promise<void>;
}

const PRICE_GAIN_QUICK_OPTIONS = [
  {
    label: '5%',
    value: 5,
  },
  {
    label: '10%',
    value: 10,
  },
  {
    label: '25%',
    value: 25,
  },
  {
    label: '50%',
    value: 50,
  },
];

export const PerpEditTpSlPriceTag: React.FC<Props> = ({
  coin,
  handleActionApproveStatus,
  entryPrice,
  markPrice,
  initTpOrSlPrice,
  direction,
  size,
  margin,
  leverage,
  liqPrice,
  pxDecimals,
  szDecimals,
  actionType,
  type,
  handleSetAutoClose,
  handleCancelAutoClose,
}) => {
  const [modalVisible, setModalVisible] = React.useState(false);
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const {
    value: autoClosePrice,
    onChangeText: setAutoClosePrice,
    displayedValue: displayedAutoClosePrice,
  } = useSlTpUsdInput({ szDecimals });

  const [activeOption, setActiveOption] = React.useState<number>(0);

  const priceIsEmptyValue = useMemo(() => {
    return !autoClosePrice || !Number(autoClosePrice);
  }, [autoClosePrice]);

  const autoCloseInputRef = React.useRef<any>(null);

  const disableEdit = useMemo(() => {
    return !size || !margin;
  }, [size, margin]);

  // Calculate gain percentage from price
  const calculatedPnl = React.useMemo(() => {
    if (!autoClosePrice) {
      return '';
    }
    const costPrice =
      type === 'openPosition' ? markPrice : entryPrice || markPrice;
    const pnlUsdValue =
      direction === 'Long'
        ? (Number(autoClosePrice) - costPrice) * size
        : (costPrice - Number(autoClosePrice)) * size;
    return pnlUsdValue;
  }, [autoClosePrice, markPrice, size, type, direction, entryPrice]);

  const gainOrLoss = useMemo(() => {
    return Number(calculatedPnl) >= 0 ? 'gain' : 'loss';
  }, [calculatedPnl]);

  const gainPct = useMemo(() => {
    return Number(calculatedPnl) / margin;
  }, [calculatedPnl, margin]);

  // Handle price input change
  const handlePriceChange = useMemoizedFn((v: string) => {
    setActiveOption(0);
    setAutoClosePrice(v);
  });

  // 验证价格输入
  const priceValidation = React.useMemo(() => {
    const autoCloseValue = Number(autoClosePrice) || 0;
    const resObj = {
      isValid: true,
      error: '',
      errorMessage: '',
    };

    if (!autoCloseValue) {
      resObj.isValid = false;
      return resObj;
    }

    // 验证止盈价格
    if (actionType === 'tp') {
      if (direction === 'Long' && autoCloseValue <= markPrice) {
        resObj.isValid = false;
        resObj.error = 'invalid_tp_long';
        resObj.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.takeProfitTipsLong',
        );
      }
      if (direction === 'Short' && autoCloseValue >= markPrice) {
        resObj.isValid = false;
        resObj.error = 'invalid_tp_short';
        resObj.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.takeProfitTipsShort',
        );
      }
    }

    // 验证止损价格
    if (actionType === 'sl') {
      if (direction === 'Long' && autoCloseValue >= markPrice) {
        resObj.isValid = false;
        resObj.error = 'invalid_sl_long';
        resObj.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsLong',
        );
      } else if (direction === 'Long' && autoCloseValue < liqPrice) {
        // warning
        resObj.isValid = false;
        resObj.error = 'invalid_sl_liquidation';
        resObj.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsLongLiquidation',
          {
            price: `$${splitNumberByStep(liqPrice.toFixed(pxDecimals))}`,
          },
        );
      }
      if (direction === 'Short' && autoCloseValue <= markPrice) {
        resObj.isValid = false;
        resObj.error = 'invalid_sl_short';
        resObj.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsShort',
        );
      } else if (direction === 'Short' && autoCloseValue > liqPrice) {
        // warning
        resObj.isValid = false;
        resObj.error = 'invalid_sl_liquidation';
        resObj.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsShortLiquidation',
          {
            price: `$${splitNumberByStep(liqPrice.toFixed(pxDecimals))}`,
          },
        );
      }
    }

    return resObj;
  }, [
    autoClosePrice,
    direction,
    markPrice,
    t,
    liqPrice,
    pxDecimals,
    actionType,
  ]);

  const isValidPrice = priceValidation.isValid;

  const {
    runAsync: handleConfirm,
    cancel,
    loading,
  } = useRequest(
    async () => {
      await handleSetAutoClose(autoClosePrice);
    },
    {
      manual: true,
      onError(error: any) {
        console.error('Failed to set auto close:', error);
        toast.error(error.message || 'Failed to set auto close');
      },
      onSuccess() {
        setModalVisible(false);
      },
    },
  );

  React.useEffect(() => {
    if (!modalVisible) {
      setAutoClosePrice('');
      setActiveOption(0);
      cancel();
    }
  }, [cancel, setAutoClosePrice, modalVisible]);

  const handleQuickOptionPress = useMemoizedFn((pct: number) => {
    setActiveOption(pct);
    const pctValue = Number(pct) / 100;
    const costPrice =
      type === 'openPosition' ? markPrice : entryPrice || markPrice;
    const costValue = (costPrice * size) / Number(leverage);
    const pnlUsdValue = costValue * pctValue;
    const priceDifference = Number((pnlUsdValue / size).toFixed(pxDecimals));

    if (actionType === 'tp') {
      const newPrice =
        direction === 'Long'
          ? costPrice + priceDifference
          : costPrice - priceDifference;
      const newPriceStr = formatTpOrSlPrice(newPrice, szDecimals);
      setAutoClosePrice(newPriceStr);
    } else {
      const newPrice =
        direction === 'Long'
          ? costPrice - priceDifference
          : costPrice + priceDifference;
      const newPriceStr = formatTpOrSlPrice(newPrice, szDecimals);
      setAutoClosePrice(newPriceStr);
    }
  });

  React.useEffect(() => {
    if (modalVisible) {
      if (initTpOrSlPrice) {
        setAutoClosePrice(initTpOrSlPrice);
      } else {
        if (type === 'openPosition') {
          handleQuickOptionPress(PRICE_GAIN_QUICK_OPTIONS[0]!.value);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  useEffect(() => {
    if (modalVisible && type === 'hasPosition') {
      // Increase delay to wait for modal animation to complete
      const timer = setTimeout(() => {
        autoCloseInputRef.current?.focus();
      }, 300);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  return (
    <>
      <TouchableOpacity
        style={styles.tagContainer}
        onPress={async () => {
          await handleActionApproveStatus?.();
          if (initTpOrSlPrice) {
            await handleCancelAutoClose();
            return;
          }

          if (disableEdit) {
            toast.error(t('page.perps.PerpsAutoCloseModal.noPosition'));
            return;
          }
          setModalVisible(true);
        }}>
        <Text style={[styles.tagText, disableEdit && styles.tagTextDisabled]}>
          {initTpOrSlPrice ? `$${splitNumberByStep(initTpOrSlPrice)}` : '-'}
        </Text>
        {initTpOrSlPrice ? (
          <IconPerpDelete
            width={16}
            height={16}
            color={colors2024['neutral-secondary']}
          />
        ) : (
          <IconPerpEdit
            width={16}
            height={16}
            color={
              disableEdit
                ? colors2024['brand-disable']
                : colors2024['brand-default']
            }
          />
        )}
      </TouchableOpacity>
      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => {
          if (loading) {
            return;
          }
          setModalVisible(false);
        }}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}>
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => {
              if (loading) {
                return;
              }
              setModalVisible(false);
            }}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.modal}
              onPress={evt => {
                evt.stopPropagation();
              }}>
              <View style={styles.container}>
                <View style={styles.inner}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      setModalVisible(false);
                    }}>
                    <RcIconCloseCC
                      width={20}
                      height={20}
                      color={colors2024['neutral-secondary']}
                    />
                  </TouchableOpacity>
                  <View style={styles.header}>
                    <Text style={styles.title}>
                      {direction} {coin}-USD
                    </Text>
                    {type === 'openPosition' ? (
                      <Text style={styles.subTitle}>
                        {t(
                          'page.perpsDetail.PerpsAutoCloseModal.currentPrice',
                          {
                            price: `$${splitNumberByStep(markPrice)}`,
                          },
                        )}
                      </Text>
                    ) : (
                      <Text style={styles.subTitle}>
                        {t(
                          'page.perpsDetail.PerpsAutoCloseModal.EntryAndCurrentPrice',
                          {
                            entryPrice: `$${splitNumberByStep(
                              entryPrice || markPrice,
                            )}`,
                            price: `$${splitNumberByStep(markPrice)}`,
                          },
                        )}
                      </Text>
                    )}
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.bodyTitle}>
                      {actionType === 'tp'
                        ? t(
                            'page.perpsDetail.PerpsAutoCloseModal.takeProfitWhen',
                          )
                        : t(
                            'page.perpsDetail.PerpsAutoCloseModal.stopLossWhen',
                          )}
                    </Text>
                    <View style={styles.formRow}>
                      {PRICE_GAIN_QUICK_OPTIONS.map(option => (
                        <View
                          style={StyleSheet.flatten([
                            styles.formItemQuickOption,
                            activeOption === option.value
                              ? {
                                  backgroundColor: colors2024['brand-light-1'],
                                  borderColor: colors2024['brand-default'],
                                }
                              : null,
                          ])}>
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => {
                              handleQuickOptionPress(option.value);
                            }}>
                            <Text
                              style={StyleSheet.flatten([
                                styles.formItemQuickTitle,
                                activeOption === option.value &&
                                  styles.formItemQuickTitleActive,
                              ])}>
                              {actionType === 'tp' ? '+' : '-'} {option.label}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    <View style={styles.formRow}>
                      <View style={styles.formItemHalf}>
                        <Text style={styles.formItemLabel}>
                          {direction === 'Long'
                            ? actionType === 'tp'
                              ? t(
                                  'page.perpsDetail.PerpsAutoCloseModal.priceAbove',
                                )
                              : t(
                                  'page.perpsDetail.PerpsAutoCloseModal.priceBelow',
                                )
                            : actionType === 'tp'
                            ? t(
                                'page.perpsDetail.PerpsAutoCloseModal.priceBelow',
                              )
                            : t(
                                'page.perpsDetail.PerpsAutoCloseModal.priceAbove',
                              )}
                        </Text>
                        <TextInput
                          keyboardType="numeric"
                          style={[
                            styles.input,
                            priceValidation.error ? styles.inputError : null,
                          ]}
                          placeholder="$0"
                          value={displayedAutoClosePrice}
                          onChangeText={handlePriceChange}
                          ref={autoCloseInputRef}
                        />
                      </View>
                    </View>

                    <View style={styles.pnlTextWrapper}>
                      {priceValidation.error ? (
                        <Text style={styles.errorMsg}>
                          {priceValidation.errorMessage}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.pnlCardWrapper}>
                      <View style={styles.pnlCardWrapperItem}>
                        <Text style={[styles.pnlText]}>
                          {gainOrLoss === 'gain'
                            ? t('page.perpsDetail.PerpsAutoCloseModal.youGain')
                            : t('page.perpsDetail.PerpsAutoCloseModal.youLoss')}
                          :
                        </Text>
                        {priceValidation.error || priceIsEmptyValue ? (
                          <Text style={styles.infoText}>-</Text>
                        ) : (
                          <Text
                            style={[
                              styles.infoText,
                              {
                                color:
                                  gainOrLoss === 'gain'
                                    ? colors2024['green-default']
                                    : colors2024['red-default'],
                              },
                            ]}>
                            {gainOrLoss === 'gain' ? '+' : '-'}
                            {formatPerpsPct(Math.abs(Number(gainPct)))}
                          </Text>
                        )}
                      </View>
                      <View style={styles.pnlCardWrapperItem}>
                        <Text style={[styles.pnlText]}>
                          {actionType === 'tp'
                            ? t(
                                'page.perpsDetail.PerpsAutoCloseModal.takeProfitExpectedPNL',
                              )
                            : t(
                                'page.perpsDetail.PerpsAutoCloseModal.stopLossExpectedPNL',
                              )}
                          :
                        </Text>
                        {priceValidation.error || priceIsEmptyValue ? (
                          <Text style={styles.infoText}>-</Text>
                        ) : (
                          <Text
                            style={[
                              styles.infoText,
                              {
                                color:
                                  gainOrLoss === 'gain'
                                    ? colors2024['green-default']
                                    : colors2024['red-default'],
                              },
                            ]}>
                            {gainOrLoss === 'gain' ? '+' : '-'}
                            {formatUsdValue(Math.abs(Number(calculatedPnl)))}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.footer}>
                    <Button
                      type="primary"
                      loading={loading}
                      title={t('global.confirm')}
                      disabled={!isValidPrice}
                      onPress={handleConfirm}
                      containerStyle={styles.containerStyle}
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  tagContainer: {
    borderRadius: 100,
    backgroundColor: colors2024['brand-light-1'],
    paddingVertical: 4,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 6,
  },
  tagText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
  tagTextDisabled: {
    color: colors2024['brand-disable'],
  },
  keyboardAvoidView: {
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  container: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-0'],
    borderRadius: 24,
  },

  inner: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
  },

  closeButton: {
    position: 'absolute',
    right: 20,
    top: 20,
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },

  header: {
    marginTop: 36,
    marginBottom: 16,
  },

  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginBottom: 8,
    textAlign: 'center',
  },

  subTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },

  body: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  bodyTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    textAlign: 'left',
  },

  formRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  formItemQuickOption: {
    flex: 1,
    width: 0,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-5'],
    borderWidth: 1,
    borderColor: 'transparent',
  },

  formItemQuickTitleActive: {
    color: colors2024['brand-default'],
  },

  formItemQuickTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },

  formItemHalf: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },

  gainInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    position: 'relative',
  },
  percentSymbol: {
    position: 'absolute',
    right: 10,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },

  modal: {
    width: '100%',
    position: 'relative',
  },

  pnlCardWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    // marginTop: 12,
    gap: 16,
    padding: 16,
  },

  pnlCardWrapperItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  pnlText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },

  pnlValueText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },

  infoText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: colors2024['neutral-info'],
  },

  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-body'],
    marginBottom: 32,
    marginTop: 12,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  accountContainer: {
    marginHorizontal: 5,
    marginBottom: 28,
    alignSelf: 'stretch',
  },

  containerStyle: {
    // width: '100%',
    // height: 40,
    height: 48,
    flex: 1,
  },
  buttonStyle: {},

  formItemLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
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
  pnlTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 4,
    // paddingHorizontal: 6,
  },
  errorMsgWarning: {
    color: colors2024['orange-default'],
  },
  errorMsgGreen: {
    color: colors2024['green-default'],
  },
  youGainOrLossText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  youGainOrLossValueText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
  },
  input: {
    ...(Platform.OS === 'ios' && {
      fontFamily: 'SF Pro Rounded', // avoid some android phone show number not in center
    }),
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    width: '100%',
    color: colors2024['neutral-title-1'],
    textAlign: 'left',
  },
  inputError: {
    color: colors2024['red-default'],
  },
}));
