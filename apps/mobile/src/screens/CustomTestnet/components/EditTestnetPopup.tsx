/* eslint-disable @typescript-eslint/no-shadow */
import RcIconFlash from '@/assets/icons/custom-testnet/flash-cc.svg';
import RcIconRight from '@/assets/icons/custom-testnet/right-cc.svg';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  Button,
} from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { apiCustomTestnet } from '@/core/apis';
import {
  TestnetChain,
  TestnetChainBase,
} from '@/core/services/customTestnetService';
import { useThemeColors } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Keyboard,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';
import { AddFromChainList } from './AddFromChainList';
import { CustomTestnetForm } from './CustomTestnetForm';
import { ModalLayouts } from '@/constant/layout';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AutoLockView from '@/components/AutoLockView';

export const EditCustomTestnetPopup = ({
  data,
  visible,
  onCancel,
  onConfirm,
  isEdit,
  onChange,
  ctx,
}: {
  isEdit?: boolean;
  data?: TestnetChainBase | null;
  visible: boolean;
  onCancel(): void;
  onConfirm(values: TestnetChain): void;
  onChange?: (values: Partial<TestnetChainBase>) => void;
  height?: number;
  ctx?: {
    ga?: {
      source?: string;
    };
  };
}) => {
  const [isShowAddFromChainList, setIsShowAddFromChainList] = useState(false);
  const [isShowModifyRpcModal, setIsShowModifyRpcModal] = useState(false);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const formik = useCustomTestnetForm({
    onSubmit(values) {},
  });

  const resetForm = useMemoizedFn(() => {
    formik.resetForm();
  });

  const setFormValues = useMemoizedFn((values: Partial<TestnetChainBase>) => {
    formik.setValues(values);
  });

  const { loading, runAsync: runAddTestnet } = useRequest(
    (
      data: TestnetChainBase,
      ctx?: {
        ga?: {
          source?: string;
        };
      },
    ) => {
      return isEdit
        ? apiCustomTestnet.updateCustomTestnet(data)
        : apiCustomTestnet.addCustomTestnet(data, ctx);
    },
    {
      manual: true,
    },
  );

  const handleSubmit = async () => {
    const values = formik.values as any;
    const errors = await formik.validateForm();
    const isValid = Object.keys(errors || {}).length === 0;
    if (!isValid) {
      return;
    }
    const res = await runAddTestnet(values, ctx);
    if ('error' in res) {
      formik.setFieldError(res.error.key, res.error.message);

      // if (!isEdit && res.error.status === 'alreadySupported') {
      //   setIsShowModifyRpcModal(true);
      //   setFormValues(form.getFieldsValue());
      // }
    } else {
      onConfirm?.(res);
    }
  };

  useEffect(() => {
    if (data && visible) {
      setFormValues(data);
    }
  }, [data, setFormValues, visible]);

  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [resetForm, visible]);

  const modalRef = React.useRef<AppBottomSheetModal>(null);
  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setIsShowAddFromChainList(false);
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
              style={{ paddingTop: ModalLayouts.titleTopOffset }}
              title={t('page.customRpc.EditCustomTestnetModal.title')}
            />
            <KeyboardAwareScrollView
              style={styles.container}
              enableOnAndroid
              scrollEnabled
              keyboardOpeningTime={0}
              keyboardShouldPersistTaps="handled">
              <View style={styles.main}>
                <TouchableOpacity
                  onPress={() => {
                    setIsShowAddFromChainList(true);
                  }}
                  style={styles.quickAdd}>
                  <RcIconFlash color={colors['neutral-body']} />
                  <Text style={styles.quickAddText}>
                    {t('page.customRpc.EditCustomTestnetModal.quickAdd')}
                  </Text>
                  <RcIconRight color={colors['neutral-body']} />
                </TouchableOpacity>
                <CustomTestnetForm formik={formik} isEdit={isEdit} />
              </View>
            </KeyboardAwareScrollView>
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
                title={'Confirm'}
                buttonStyle={[
                  styles.buttonStyle,
                  { backgroundColor: colors['blue-default'] },
                ]}
                style={{
                  width: '100%',
                }}
                titleStyle={styles.btnConfirmTitle}
                onPress={handleSubmit}
                loading={loading}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnConfirmContainer,
                ]}
              />
            </View>
            <AddFromChainList
              visible={isShowAddFromChainList}
              onClose={() => {
                setIsShowAddFromChainList(false);
              }}
              onSelect={item => {
                formik.resetForm();
                formik.setValues(item);
                setIsShowAddFromChainList(false);
                const source = ctx?.ga?.source || 'setting';
                matomoRequestEvent({
                  category: 'Custom Network',
                  action: 'Choose ChainList Network',
                  label: `${source}_${String(item.id)}`,
                });
              }}
            />
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
    quickAdd: {
      borderRadius: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors['blue-light-1'],
      marginBottom: 20,
    },
    quickAddText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
  });
