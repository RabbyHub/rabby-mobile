import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface Props {
  visible?: boolean;
  coin: string;
  price: number;
  direction: 'Long' | 'Short';
  size: number;
  liqPrice: number;
  pxDecimals: number;
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
  onClose,
  type,
  handleSetAutoClose,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  const [tpPrice, setTpPrice] = React.useState<string>('');
  const [slPrice, setSlPrice] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(false);
  const tpInputRef = React.useRef<HTMLInputElement>(null);

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
        resObj.tp.errorMessage = t('page.perps.takeProfitTipsLong');
      }
      if (direction === 'Short' && tpValue >= price) {
        resObj.tp.isValid = false;
        resObj.tp.error = 'invalid_tp_short';
        resObj.tp.errorMessage = t('page.perps.takeProfitTipsShort');
      }
    }

    // 验证止损价格
    if (slPrice) {
      if (direction === 'Long' && slValue >= price) {
        resObj.sl.isValid = false;
        resObj.sl.error = 'invalid_sl_long';
        resObj.sl.errorMessage = t('page.perps.stopLossTipsLong');
      } else if (direction === 'Long' && slValue < liqPrice) {
        // warning
        resObj.sl.isValid = true;
        resObj.sl.isWarning = true;
        resObj.sl.error = '';
        resObj.sl.errorMessage = t('page.perps.stopLossTipsLongLiquidation', {
          price: `$${splitNumberByStep(liqPrice)}`,
        });
      }
      if (direction === 'Short' && slValue <= price) {
        resObj.sl.isValid = false;
        resObj.sl.error = 'invalid_sl_short';
        resObj.sl.errorMessage = t('page.perps.stopLossTipsShort');
      } else if (direction === 'Short' && slValue > liqPrice) {
        // warning
        resObj.sl.isValid = true;
        resObj.sl.isWarning = true;
        resObj.sl.error = '';
        resObj.sl.errorMessage = t('page.perps.stopLossTipsShortLiquidation', {
          price: `$${splitNumberByStep(liqPrice)}`,
        });
      }
    }

    return resObj;
  }, [tpPrice, slPrice, direction, price, t, liqPrice]);

  React.useEffect(() => {
    if (!visible) {
      setTpPrice('');
      setSlPrice('');
    }
  }, [visible]);

  const isValidPrice = priceValidation.tp.isValid && priceValidation.sl.isValid;

  // 获取错误状态下的文字颜色
  const getMarginTextColor = (type: 'tp' | 'sl') => {
    if (priceValidation[type].error) {
      return 'text-r-red-default';
    }
    if (priceValidation[type].isWarning) {
      return 'text-r-orange-default';
    }
    return 'text-r-neutral-title-1';
  };

  const handleConfirm = useMemoizedFn(async () => {
    setLoading(true);
    try {
      await handleSetAutoClose({
        tpPrice,
        slPrice,
      });
      onClose();
    } catch (error) {
      console.error('Failed to set auto close:', error);
      // message.error(error.message || 'Failed to set auto close');
    } finally {
      setLoading(false);
    }
  });

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalOverlay}
        onPress={onClose}>
        <TouchableOpacity
          onPress={event => {
            event.stopPropagation();
          }}
          activeOpacity={1}
          style={styles.container}>
          <KeyboardAwareScrollView
            enableOnAndroid
            scrollEnabled
            keyboardOpeningTime={0}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.inner}
            keyboardDismissMode="interactive">
            <View style={styles.header}>
              <Text style={styles.title}>
                {direction} {coin}-USD
              </Text>
              {type === 'openPosition' ? (
                <Text style={styles.subTitle}>
                  {coin}-USD Price: ${splitNumberByStep(price)}
                </Text>
              ) : (
                <Text style={styles.subTitle}>
                  Entry Price: ${splitNumberByStep(price)}
                </Text>
              )}
            </View>
            <View style={styles.body}>
              <View style={styles.formItem}>
                <Text style={styles.formItemLabel}>Take Profit Price</Text>

                <TextInput
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="$0"
                  value={tpPrice}
                  onChangeText={setTpPrice}
                />
                <View style={styles.errorMsgContainer}>
                  {priceValidation.tp.error ? (
                    <Text style={styles.errorMsg}>
                      {priceValidation.tp.errorMessage}
                    </Text>
                  ) : tpPrice ? (
                    <Text style={styles.errorMsg}>
                      {t('page.perps.takeProfit')}{' '}
                      {formatUsdValue(Math.abs(tpProfit))}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.formItem}>
                <Text style={styles.formItemLabel}>Stop Loss Price</Text>

                <TextInput
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="$0"
                  value={slPrice}
                  onChangeText={setSlPrice}
                />

                <View style={styles.errorMsgContainer}>
                  {priceValidation.sl.error ? (
                    <Text style={styles.errorMsg}>
                      {priceValidation.sl.errorMessage}
                    </Text>
                  ) : priceValidation.sl.isWarning ? (
                    <Text style={styles.errorMsg}>
                      {priceValidation.sl.errorMessage}
                    </Text>
                  ) : slPrice ? (
                    <Text style={styles.errorMsg}>
                      {t('page.perps.stopLoss')}{' '}
                      {formatUsdValue(Math.abs(slLoss))}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <Button
                type="primary"
                title={t('global.confirm')}
                onPress={handleConfirm}
                containerStyle={styles.containerStyle}
              />
            </View>
          </KeyboardAwareScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-2'],
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
    backgroundColor: colors2024['neutral-bg-1'],
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
  input: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    // color: ctx.colors2024['neutral-body'],
    flex: 1,
  },
}));
