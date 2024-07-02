import { Tip } from '@/components';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
} from '@/components/customized/BottomSheet';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { useThemeColors } from '@/hooks/theme';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInputChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from './Actions/components/Card';
import DescItem from './Actions/components/DescItem';
import { getStyles } from './TxComponents/GasSelector/styles';

export interface GasSelectorResponse {
  gasLimit: number;
  nonce: number;
}

interface GasSelectorProps {
  gasLimit: string | undefined;
  onChange(gas: GasSelectorResponse): void;
  isReady: boolean;
  recommendGasLimit: number | string | BigNumber;
  recommendNonce: number | string | BigNumber;
  nonce: string;
  disableNonce: boolean;
  disabled?: boolean;
  manuallyChangeGasLimit: boolean;
}

export const SignAdvancedSettings = ({
  gasLimit,
  onChange,
  isReady,
  recommendGasLimit,
  recommendNonce,
  nonce,
  disableNonce,
  disabled,
  manuallyChangeGasLimit,
}: GasSelectorProps) => {
  const [visible, setVisible] = React.useState(false);
  const { t } = useTranslation();
  const [afterGasLimit, setGasLimit] = React.useState<string | number>(
    Number(gasLimit),
  );
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [customNonce, setCustomNonce] = React.useState(Number(nonce));
  const [isFirstTimeLoad, setIsFirstTimeLoad] = React.useState(true);
  const [validateStatus, setValidateStatus] = React.useState<
    Record<string, { status: any; message: string | null }>
  >({
    gasLimit: {
      status: 'success',
      message: null,
    },
    nonce: {
      status: 'success',
      message: null,
    },
  });

  const modalRef = React.useRef<AppBottomSheetModal>(null);
  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const handleSetRecommendTimes = () => {
    if (disabled) return;
    const value = new BigNumber(recommendGasLimit).times(1.5).toFixed(0);
    setGasLimit(value);
  };

  const formValidator = () => {
    const newValue: Record<string, { status: any; message: string | null }> = {
      ...validateStatus,
      gasLimit: {
        status: 'success',
        message: null,
      },
      nonce: {
        status: 'success',
        message: null,
      },
    };

    if (!afterGasLimit) {
      newValue.gasLimit = {
        status: 'error',
        message: t('page.signTx.gasLimitEmptyAlert'),
      };
    } else if (Number(afterGasLimit) < MINIMUM_GAS_LIMIT) {
      newValue.gasLimit = {
        status: 'error',
        message: t('page.signTx.gasLimitMinValueAlert'),
      };
    }
    if (new BigNumber(customNonce).lt(recommendNonce) && !disableNonce) {
      newValue.nonce = {
        status: 'error',
        // @ts-expect-error
        message: t('page.signTx.nonceLowerThanExpect', [
          new BigNumber(recommendNonce).toString(),
        ]),
      };
    }

    setValidateStatus(newValue);
  };

  const handleConfirmGas = () => {
    onChange({
      gasLimit: Number(afterGasLimit),
      nonce: Number(customNonce),
    });
  };

  const handleGasLimitChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    if (/^\d*$/.test(e.nativeEvent.text)) {
      setGasLimit(e.nativeEvent.text);
    }
  };

  const handleCustomNonceChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    if (/^\d*$/.test(e.nativeEvent.text)) {
      setCustomNonce(Number(e.nativeEvent.text));
    }
  };

  const handleModalConfirmGas = () => {
    handleConfirmGas();
    setVisible(false);
  };

  React.useEffect(() => {
    setGasLimit(Number(gasLimit));
  }, [gasLimit]);

  React.useEffect(() => {
    formValidator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterGasLimit, customNonce]);

  React.useEffect(() => {
    setCustomNonce(Number(nonce));
  }, [nonce]);

  React.useEffect(() => {
    if (isReady && isFirstTimeLoad) {
      setIsFirstTimeLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return (
    <>
      <Card
        headline={t('page.signTx.advancedSettings')}
        onAction={() => setVisible(true)}
        hasDivider={manuallyChangeGasLimit}>
        {manuallyChangeGasLimit && (
          <View style={styles.cardBody}>
            <DescItem>
              <Text style={styles.cardBodyText}>
                {t('page.signTx.manuallySetGasLimitAlert')} {Number(gasLimit)}
              </Text>
            </DescItem>
          </View>
        )}
      </Card>

      <AppBottomSheetModal
        enableDynamicSizing
        keyboardBlurBehavior="restore"
        onDismiss={() => setVisible(false)}
        ref={modalRef}
        handleStyle={styles.cardModal}>
        <BottomSheetView style={styles.cardModal}>
          <AppBottomSheetModalTitle title={t('page.signTx.advancedSettings')} />

          <View style={styles.cardMain}>
            <View>
              <Tip
                content={
                  disabled
                    ? t('page.signTx.gasNotRequireForSafeTransaction')
                    : undefined
                }>
                <Text
                  style={StyleSheet.flatten([
                    styles.gasLimitLabelText,
                    disabled && styles.gasLimitLabelTextDisabled,
                  ])}>
                  {t('page.signTx.gasLimitTitle')}
                </Text>
                <BottomSheetTextInput
                  keyboardType="number-pad"
                  style={styles.gasLimitInput}
                  value={afterGasLimit.toString()}
                  onChange={handleGasLimitChange}
                />
              </Tip>
              <View
                style={StyleSheet.flatten({
                  overflow: 'hidden',
                  height: 25,
                })}>
                {validateStatus.gasLimit.message ? (
                  <Text
                    style={StyleSheet.flatten([
                      styles.tip,
                      {
                        color: colors['red-default'],
                      },
                    ])}>
                    {validateStatus.gasLimit.message}
                  </Text>
                ) : (
                  <View
                    style={StyleSheet.flatten({
                      flexDirection: 'row',
                      alignItems: 'baseline',
                    })}>
                    <Text
                      style={StyleSheet.flatten([
                        styles.tip,
                        disabled && styles.tipDisabled,
                      ])}>
                      <Trans
                        i18nKey="page.signTx.recommendGasLimitTip"
                        values={{
                          est: Number(recommendGasLimit),
                          current: new BigNumber(afterGasLimit)
                            .div(recommendGasLimit)
                            .toFixed(1),
                        }}
                      />
                    </Text>
                    <TouchableOpacity onPress={handleSetRecommendTimes}>
                      <Text
                        style={StyleSheet.flatten([
                          styles.tip,
                          styles.recommendTimes,
                          disabled && styles.tipDisabled,
                        ])}>
                        1.5x
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={StyleSheet.flatten([
                        styles.tip,
                        disabled && styles.tipDisabled,
                      ])}>
                      .
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View
              style={StyleSheet.flatten({
                opacity: disableNonce ? 0.5 : 1,
              })}>
              <Text style={styles.nonceTitle}>
                {t('page.signTx.nonceTitle')}
              </Text>
              <BottomSheetTextInput
                keyboardType="number-pad"
                style={styles.gasLimitInput}
                value={customNonce.toString()}
                onChange={handleCustomNonceChange}
                // disabled={disableNonce}
              />
              {validateStatus.nonce.message ? (
                <Text
                  style={StyleSheet.flatten([
                    styles.tip,
                    {
                      color: colors['red-default'],
                    },
                  ])}>
                  {validateStatus.nonce.message}
                </Text>
              ) : (
                <Text style={styles.tip}>
                  {t('page.signTx.gasLimitModifyOnlyNecessaryAlert')}
                </Text>
              )}
            </View>
          </View>
          <FooterButton
            footerStyle={styles.footer}
            title={t('global.confirm')}
            onPress={handleModalConfirmGas}
            disabled={!isReady}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};
