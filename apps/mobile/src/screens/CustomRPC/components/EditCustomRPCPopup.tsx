/* eslint-disable @typescript-eslint/no-shadow */
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  Button,
} from '@/components';
import AutoLockView from '@/components/AutoLockView';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { FormInput } from '@/components/Form/Input';
import { CHAINS_ENUM } from '@/constant/chains';
import { ModalLayouts } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomRPC } from '@/core/apis';
import { RPCItem } from '@/core/services/customRPCService';
import { useThemeColors } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { isValidateUrl } from '@/utils/url';
import { useRequest } from 'ahooks';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import useDebounce from 'react-use/lib/useDebounce';

export const EditCustomRPCPopup = ({
  rpcInfo,
  visible,
  onCancel,
  onConfirm,
  chainEnum,
}: {
  chainEnum: CHAINS_ENUM;
  rpcInfo?: { id: CHAINS_ENUM; rpc: RPCItem } | null;
  visible: boolean;
  onCancel(): void;
  onConfirm(url: string): void | Promise<void>;
  height?: number;
}) => {
  const chainItem = useMemo(() => findChainByEnum(chainEnum), [chainEnum]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const [rpcUrl, setRpcUrl] = useState('');
  const [rpcErrorMsg, setRpcErrorMsg] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const canSubmit = useMemo(() => {
    return rpcUrl && !rpcErrorMsg && !isValidating;
  }, [rpcUrl, rpcErrorMsg, isValidating]);

  const handleRPCChanged = (url: string) => {
    setRpcUrl(url);
    if (!isValidateUrl(url)) {
      setRpcErrorMsg(t('page.customRpc.EditRPCModal.invalidRPCUrl'));
    }
  };

  const rpcValidation = async () => {
    if (!chainItem) {
      return;
    }

    if (!isValidateUrl(rpcUrl)) {
      return;
    }
    try {
      setIsValidating(true);
      const isValid = await apiCustomRPC.validateRPC(rpcUrl, chainItem.id);
      setIsValidating(false);
      if (!isValid) {
        setRpcErrorMsg(t('page.customRpc.EditRPCModal.invalidChainId'));
      } else {
        setRpcErrorMsg('');
      }
    } catch (e) {
      setIsValidating(false);
      setRpcErrorMsg(t('page.customRpc.EditRPCModal.rpcAuthFailed'));
    }
  };

  useDebounce(rpcValidation, 200, [rpcUrl]);

  useEffect(() => {
    if (rpcInfo) {
      setRpcUrl(rpcInfo.rpc.url);
    } else {
      setRpcUrl('');
    }
  }, [rpcInfo]);

  useEffect(() => {
    if (!visible) {
      setRpcUrl('');
      setRpcErrorMsg('');
    }
  }, [visible]);

  const { loading, runAsync: handleSubmit } = useRequest(
    async () => {
      await onConfirm?.(rpcUrl);
    },
    {
      manual: true,
    },
  );

  const modalRef = React.useRef<AppBottomSheetModal>(null);
  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      snapPoints={['80%']}
      ref={modalRef}
      onDismiss={onCancel}>
      <AutoLockView style={{ height: '100%' }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            <AppBottomSheetModalTitle
              style={{
                paddingTop: ModalLayouts.titleTopOffset,
                paddingBottom: 40,
              }}
              title={t('page.customRpc.EditRPCModal.title')}
            />
            <View style={styles.main}>
              <View style={styles.header}>
                <ChainIconImage chainEnum={chainEnum} size={56} />
                <Text style={styles.chainName}>{chainItem?.name}</Text>
              </View>
              <View style={[styles.formItem]}>
                <Text style={styles.formLabel}>
                  {t('page.customRpc.EditRPCModal.rpcUrl')}
                </Text>
                <FormInput
                  inputStyle={[styles.input]}
                  // className="mt-[8]"
                  // containerStyle={styles.inputContainer}
                  // ref={formInputRef}
                  // disableFocusingStyle
                  // inputStyle={styles.input}
                  hasError={!!rpcErrorMsg}
                  inputProps={{
                    // ...inputProps,
                    autoFocus: true,
                    numberOfLines: 1,
                    multiline: false,
                    value: rpcUrl,
                    editable: true,
                    placeholder: 'Enter the RPC URL',
                    placeholderTextColor: colors['neutral-foot'],
                    onChangeText: value => {
                      handleRPCChanged(value);
                    },
                  }}
                />
                {rpcErrorMsg ? (
                  <View style={styles.formItemExtra}>
                    <Text style={styles.formItemError}>{rpcErrorMsg}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.footer}>
              <Button
                onPress={onCancel}
                title={'Cancel'}
                buttonStyle={[styles.buttonStyle]}
                titleStyle={styles.btnCancelTitle}
                type="white"
                containerStyle={[
                  styles.btnContainer,
                  styles.btnCancelContainer,
                ]}
              />
              <Button
                title={'Save'}
                buttonStyle={[
                  styles.buttonStyle,
                  { backgroundColor: colors['blue-default'] },
                ]}
                style={{
                  width: '100%',
                }}
                disabled={!canSubmit}
                titleStyle={styles.btnConfirmTitle}
                onPress={handleSubmit}
                loading={loading}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnConfirmContainer,
                ]}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      height: '100%',
    },
    header: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    chainName: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
    },
    footer: {
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 35,
    },
    main: {
      paddingHorizontal: 20,
      flex: 1,
    },
    btnContainer: {
      flexShrink: 1,
      display: 'flex',
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      maxWidth: '100%',
      minWidth: 0,
    },

    buttonStyle: {
      width: '100%',
      height: '100%',
    },
    btnCancelContainer: {
      borderColor: colors['blue-default'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnCancelTitle: {
      color: colors['blue-default'],
      flex: 1,
    },
    btnConfirmContainer: {},
    btnConfirmTitle: {
      color: colors['neutral-title-2'],
      flex: 1,
    },

    input: {
      height: 52,
      borderRadius: 6,
      color: colors['neutral-title-1'],
      fontWeight: '400',
      fontSize: 16,
      textAlign: undefined,
      lineHeight: undefined,
    },
    inputDisabled: {
      backgroundColor: colors['neutral-card-2'],
      borderWidth: 0,
      color: colors['neutral-foot'],
    },
    formItem: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
      marginBottom: 8,
    },
    formItemExtra: {
      marginTop: 8,
    },
    formItemError: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['red-default'],
    },
  });
