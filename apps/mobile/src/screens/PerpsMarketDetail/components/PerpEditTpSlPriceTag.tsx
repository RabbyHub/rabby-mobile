import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { toast } from '@/components2024/Toast';
import { useSlTpUsdInput } from '@/hooks/useUsdInput';

interface Props {
  coin: string;
  entryPrice?: number;
  markPrice: number;
  direction: 'Long' | 'Short';
  size: number;
  liqPrice: number;
  pxDecimals: number;
  szDecimals: number;
  actionType: 'tp' | 'sl';
  type: 'openPosition' | 'hasPosition';
  handleSetAutoClose: (price: string) => Promise<void>;
}

export const PerpEditTpSlPriceTag: React.FC<Props> = ({
  coin: _coin,
  entryPrice,
  markPrice,
  direction,
  size,
  liqPrice,
  pxDecimals,
  szDecimals,
  actionType,
  type,
  handleSetAutoClose,
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = React.useState(false);
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const {
    value: autoClosePrice,
    onChangeText: setAutoClosePrice,
    displayedValue: displayedAutoClosePrice,
  } = useSlTpUsdInput({ szDecimals });

  const [gainPct, setGainPct] = React.useState('');
  const [isEditingPrice, setIsEditingPrice] = React.useState(false);

  const autoCloseInputRef = React.useRef<any>(null);
  const gainInputRef = React.useRef<any>(null);

  // Calculate gain percentage from price
  const calculatedGainPct = React.useMemo(() => {
    if (!autoClosePrice) {
      return '';
    }
    const priceDifference = Math.abs(Number(autoClosePrice) - markPrice);
    const pnlUsdValue = priceDifference * size;
    const costValue =
      type === 'hasPosition'
        ? (entryPrice || markPrice) * size
        : markPrice * size;
    const pnlPctValue = (pnlUsdValue / costValue) * 100;

    return pnlPctValue.toFixed(2);
  }, [autoClosePrice, entryPrice, markPrice, size, type]);

  // Handle price input change
  const handlePriceChange = useMemoizedFn((value: string) => {
    setIsEditingPrice(true);
    setAutoClosePrice(value);
    // Auto update gain percentage
    if (value) {
      const priceDifference = Math.abs(Number(value) - markPrice);
      const pnlUsdValue = priceDifference * size;
      const costValue =
        type === 'hasPosition'
          ? (entryPrice || markPrice) * size
          : markPrice * size;
      const pnlPctValue = (pnlUsdValue / costValue) * 100;
      setGainPct(pnlPctValue.toFixed(2));
    } else {
      setGainPct('');
    }
    setIsEditingPrice(false);
  });

  // Handle gain percentage input change
  const handleGainPctChange = useMemoizedFn((value: string) => {
    if (isEditingPrice) {
      return;
    }

    setGainPct(value);

    if (!value) {
      setAutoClosePrice('');
      return;
    }

    const pctValue = Number(value) / 100;
    const costValue =
      type === 'hasPosition'
        ? (entryPrice || markPrice) * size
        : markPrice * size;
    const pnlUsdValue = costValue * pctValue;
    const priceDifference = pnlUsdValue / size;

    if (actionType === 'tp') {
      const newPrice =
        direction === 'Long'
          ? markPrice + priceDifference
          : markPrice - priceDifference;
      setAutoClosePrice(newPrice.toFixed(pxDecimals));
    } else {
      const newPrice =
        direction === 'Long'
          ? markPrice - priceDifference
          : markPrice + priceDifference;
      setAutoClosePrice(newPrice.toFixed(pxDecimals));
    }
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
        // onClose?.();
      },
    },
  );

  React.useEffect(() => {
    if (!modalVisible) {
      setAutoClosePrice('');
      setGainPct('');
      cancel();
    }
  }, [cancel, setAutoClosePrice, modalVisible]);

  useEffect(() => {
    if (modalVisible) {
      setTimeout(() => {
        autoCloseInputRef.current?.focus();
      }, 100);
    }
  }, [modalVisible]);

  return (
    <>
      <TouchableOpacity
        style={styles.tagContainer}
        onPress={() => setModalVisible(true)}>
        <Text style={styles.tagText}>
          {displayedAutoClosePrice ? `$${displayedAutoClosePrice}` : '-'}
        </Text>
        <IconPerpEdit
          width={16}
          height={16}
          color={colors2024['brand-default']}
        />
      </TouchableOpacity>
      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}>
            <TouchableOpacity
              onPress={event => {
                Keyboard.dismiss();
                event.stopPropagation();
              }}
              activeOpacity={1}
              style={styles.container}>
              <View style={styles.inner}>
                <View style={styles.header}>
                  <Text style={styles.title}>
                    {actionType === 'tp'
                      ? t('page.perpsDetail.PerpsAutoCloseModal.takeProfitWhen')
                      : t('page.perpsDetail.PerpsAutoCloseModal.stopLossWhen')}
                  </Text>
                  {type === 'openPosition' ? (
                    <Text style={styles.subTitle}>
                      {t('page.perpsDetail.PerpsAutoCloseModal.currentPrice', {
                        price: splitNumberByStep(markPrice),
                      })}
                    </Text>
                  ) : (
                    <Text style={styles.subTitle}>
                      {t(
                        'page.perpsDetail.PerpsAutoCloseModal.EntryAndCurrentPrice',
                        {
                          entryPrice: splitNumberByStep(
                            entryPrice || markPrice,
                          ),
                          price: splitNumberByStep(markPrice),
                        },
                      )}
                    </Text>
                  )}
                </View>
                <View style={styles.body}>
                  <View style={styles.formRow}>
                    <View style={styles.formItemHalf}>
                      <Text style={styles.formItemLabel}>
                        {t('page.perpsDetail.PerpsAutoCloseModal.priceReaches')}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        style={[
                          styles.input,
                          priceValidation.error && autoClosePrice !== ''
                            ? styles.inputError
                            : null,
                        ]}
                        placeholder="$0"
                        value={displayedAutoClosePrice}
                        onChangeText={handlePriceChange}
                        ref={autoCloseInputRef}
                      />
                    </View>

                    <View style={styles.formItemHalf}>
                      <Text style={styles.formItemLabel}>
                        {actionType === 'tp'
                          ? t('page.perpsDetail.PerpsAutoCloseModal.youGain')
                          : t('page.perpsDetail.PerpsAutoCloseModal.youLoss')}
                      </Text>
                      <View style={styles.gainInputWrapper}>
                        <TextInput
                          keyboardType="numeric"
                          style={styles.input}
                          placeholder="0"
                          value={gainPct}
                          onChangeText={handleGainPctChange}
                          ref={gainInputRef}
                        />
                        <Text style={styles.percentSymbol}>%</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.pnlTextWrapper}>
                    {priceValidation.error ? (
                      <Text style={styles.errorMsg}>
                        {priceValidation.errorMessage}
                      </Text>
                    ) : autoClosePrice && gainPct ? (
                      <>
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
                        <Text
                          style={[
                            styles.pnlValueText,
                            {
                              color:
                                actionType === 'tp'
                                  ? colors2024['green-default']
                                  : colors2024['red-default'],
                            },
                          ]}>
                          {actionType === 'tp' ? '+' : '-'}
                          {gainPct}%
                        </Text>
                      </>
                    ) : null}
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
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 24,
  },

  inner: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
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
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  formRow: {
    flexDirection: 'row',
    gap: 8,
  },

  formItemHalf: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
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

  pnlText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },

  pnlValueText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
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
  },
  errorMsgWarning: {
    color: colors2024['orange-default'],
  },
  errorMsgGreen: {
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
