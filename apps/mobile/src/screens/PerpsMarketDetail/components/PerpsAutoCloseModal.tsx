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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toast } from '@/components2024/Toast';
import { useSlTpUsdInput } from '@/hooks/useUsdInput';

interface Props {
  visible?: boolean;
  coin: string;
  price: number;
  direction: 'Long' | 'Short';
  size: number;
  liqPrice: number;
  pxDecimals: number;
  szDecimals: number;
  onClose: () => void;
  type: 'openPosition' | 'hasPosition';
  handleSetAutoClose: (params: {
    tpPrice: string;
    slPrice: string;
  }) => Promise<void>;
}

export const PerpsAutoCloseModal: React.FC<Props> = ({
  visible,
  coin,
  price,
  direction,
  size,
  liqPrice,
  pxDecimals,
  szDecimals,
  onClose,
  type,
  handleSetAutoClose,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  const {
    value: tpPrice,
    onChangeText: setTpPrice,
    displayedValue: displayedTpPrice,
  } = useSlTpUsdInput({ szDecimals });

  const {
    value: slPrice,
    onChangeText: setSlPrice,
    displayedValue: displayedSlPrice,
  } = useSlTpUsdInput({ szDecimals });

  const tpInputRef = React.useRef<any>(null);

  // React.useEffect(() => {
  //   if (visible && tpInputRef.current) {
  //     // 使用 setTimeout 确保弹窗完全渲染后再聚焦
  //     const timer = setTimeout(() => {
  //       tpInputRef.current?.focus();
  //     }, 200);

  //     return () => clearTimeout(timer);
  //   }
  // }, [visible]);

  const { tpProfit, slLoss } = React.useMemo(() => {
    const tp = Number(tpPrice) - price;
    const sl = Number(slPrice) - price;

    const tpProfitValue = direction === 'Long' ? tp * size : -tp * size;
    const slLossValue = direction === 'Long' ? sl * size : -sl * size;

    return {
      tpProfit: tpPrice ? tpProfitValue : 0,
      slLoss: slPrice ? slLossValue : 0,
    };
  }, [tpPrice, slPrice, price, direction, size]);

  // 验证价格输入
  const priceValidation = React.useMemo(() => {
    const tpValue = Number(tpPrice) || 0;
    const slValue = Number(slPrice) || 0;
    const resObj = {
      tp: {
        isValid: true,
        errorMessage: '',
        error: '',
      },
      sl: {
        isValid: true,
        error: '',
        errorMessage: '',
      },
    } as Record<
      string,
      {
        isValid: boolean;
        error: string;
        errorMessage: string;
        isWarning?: boolean;
      }
    >;

    if (!tpPrice && !slPrice) {
      resObj.tp.isValid = false;
      resObj.sl.isValid = false;
      return resObj;
    }

    // 验证止盈价格
    if (tpPrice) {
      if (direction === 'Long' && tpValue <= price) {
        resObj.tp.isValid = false;
        resObj.tp.error = 'invalid_tp_long';
        resObj.tp.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.takeProfitTipsLong',
        );
      }
      if (direction === 'Short' && tpValue >= price) {
        resObj.tp.isValid = false;
        resObj.tp.error = 'invalid_tp_short';
        resObj.tp.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.takeProfitTipsShort',
        );
      }
    }

    // 验证止损价格
    if (slPrice) {
      if (direction === 'Long' && slValue >= price) {
        resObj.sl.isValid = false;
        resObj.sl.error = 'invalid_sl_long';
        resObj.sl.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsLong',
        );
      } else if (direction === 'Long' && slValue < liqPrice) {
        // warning
        resObj.sl.isValid = true;
        resObj.sl.isWarning = true;
        resObj.sl.error = '';
        resObj.sl.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsLongLiquidation',
          {
            price: `$${splitNumberByStep(liqPrice.toFixed(pxDecimals))}`,
          },
        );
      }
      if (direction === 'Short' && slValue <= price) {
        resObj.sl.isValid = false;
        resObj.sl.error = 'invalid_sl_short';
        resObj.sl.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsShort',
        );
      } else if (direction === 'Short' && slValue > liqPrice) {
        // warning
        resObj.sl.isValid = true;
        resObj.sl.isWarning = true;
        resObj.sl.error = '';
        resObj.sl.errorMessage = t(
          'page.perps.PerpsAutoCloseModal.stopLossTipsShortLiquidation',
          {
            price: `$${splitNumberByStep(liqPrice.toFixed(pxDecimals))}`,
          },
        );
      }
    }

    return resObj;
  }, [tpPrice, slPrice, direction, price, t, liqPrice, pxDecimals]);

  const isValidPrice = priceValidation.tp.isValid && priceValidation.sl.isValid;

  const {
    runAsync: handleConfirm,
    cancel,
    loading,
  } = useRequest(
    async () => {
      await handleSetAutoClose({
        tpPrice,
        slPrice,
      });
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
    if (!visible) {
      setTpPrice('');
      setSlPrice('');
      cancel();
    }
  }, [cancel, setSlPrice, setTpPrice, visible]);

  useEffect(() => {
    if (visible) {
      tpInputRef.current?.focus();
    }
  }, [visible]);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={onClose}>
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
                  {direction} {coin}-USD
                </Text>
                {type === 'openPosition' ? (
                  <Text style={styles.subTitle}>
                    {coin}-USD {t('page.perpsDetail.PerpsAutoCloseModal.price')}{' '}
                    ${splitNumberByStep(price)}
                  </Text>
                ) : (
                  <Text style={styles.subTitle}>
                    {t('page.perpsDetail.PerpsAutoCloseModal.entryPrice')} $
                    {splitNumberByStep(price)}
                  </Text>
                )}
              </View>
              <View style={styles.body}>
                <View style={styles.formItem}>
                  <Text style={styles.formItemLabel}>
                    {t('page.perpsDetail.PerpsAutoCloseModal.setTpPrice')}
                  </Text>

                  <TextInput
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      priceValidation.tp.error && tpPrice !== ''
                        ? styles.inputError
                        : null,
                    ]}
                    placeholder="$0"
                    value={displayedTpPrice}
                    onChangeText={setTpPrice}
                    ref={tpInputRef}
                  />
                  <View style={styles.errorMsgContainer}>
                    {priceValidation.tp.error ? (
                      <Text style={styles.errorMsg}>
                        {priceValidation.tp.errorMessage}
                      </Text>
                    ) : tpPrice ? (
                      <Text style={[styles.errorMsg, styles.errorMsgGreen]}>
                        {t('page.perps.PerpsAutoCloseModal.takeProfit')}{' '}
                        {formatUsdValue(Math.abs(tpProfit))}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.formItem}>
                  <Text style={styles.formItemLabel}>
                    {t('page.perpsDetail.PerpsAutoCloseModal.setSlPrice')}
                  </Text>

                  <TextInput
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      priceValidation.sl.error && slPrice !== ''
                        ? styles.inputError
                        : null,
                    ]}
                    placeholder="$0"
                    value={displayedSlPrice}
                    onChangeText={setSlPrice}
                  />

                  <View style={styles.errorMsgContainer}>
                    {priceValidation.sl.error ? (
                      <Text style={styles.errorMsg}>
                        {priceValidation.sl.errorMessage}
                      </Text>
                    ) : priceValidation.sl.isWarning ? (
                      <Text style={[styles.errorMsg, styles.errorMsgWarning]}>
                        {priceValidation.sl.errorMessage}
                      </Text>
                    ) : slPrice ? (
                      <Text style={styles.errorMsg}>
                        {t('page.perps.PerpsAutoCloseModal.stopLoss')}{' '}
                        {formatUsdValue(Math.abs(slLoss))}
                      </Text>
                    ) : null}
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
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    borderRadius: 20,
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
    fontWeight: '700',
    color: colors2024['neutral-body'],
    textAlign: 'center',
  },

  body: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    // alignItems: 'center',
    gap: 16,
    marginBottom: 24,
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

  formItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    minHeight: 115,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
  },
  formItemLabel: {
    fontSize: 16,
    lineHeight: 20,
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
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    minWidth: 80,
    textAlign: 'center',
  },
  inputError: {
    color: colors2024['red-default'],
  },
}));
