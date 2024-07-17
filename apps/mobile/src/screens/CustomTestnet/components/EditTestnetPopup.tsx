/* eslint-disable @typescript-eslint/no-shadow */
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
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, View } from 'react-native';
import { CustomTestnetForm } from './CustomTestnetForm';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';

export const EditCustomTestnetPopup = ({
  data,
  visible,
  onCancel,
  onConfirm,
  isEdit,
  onChange,
  height,
  maskStyle,
  ctx,
}: {
  isEdit?: boolean;
  data?: TestnetChainBase | null;
  visible: boolean;
  onCancel(): void;
  onConfirm(values: TestnetChain): void;
  onChange?: (values: Partial<TestnetChainBase>) => void;
  height?: number;
  maskStyle?: React.CSSProperties;
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
    onSubmit(values) {
      console.log(values);
    },
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
    console.log(values);
    const errors = await formik.validateForm();
    const isValid = Object.keys(errors || {}).length === 0;
    console.log('v', errors, isValid);
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

  return (
    <AppBottomSheetModal snapPoints={[660]} ref={modalRef} onDismiss={onCancel}>
      <AppBottomSheetModalTitle
        title={t('page.customRpc.EditCustomTestnetModal.title')}
      />
      <CustomTestnetForm formik={formik} />
      <View style={styles.footer}>
        <Button
          onPress={onCancel}
          title={'Cancel'}
          buttonStyle={[styles.buttonStyle]}
          titleStyle={styles.btnCancelTitle}
          type="white"
          containerStyle={[styles.btnContainer, styles.btnCancelContainer]}>
          Cancel
        </Button>
        <Button
          title={'Confirm'}
          buttonStyle={[
            styles.buttonStyle,
            { backgroundColor: colors['blue-default'] },
          ]}
          titleStyle={styles.btnConfirmTitle}
          onPress={handleSubmit}
          containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}>
          Confirm
        </Button>
      </View>
    </AppBottomSheetModal>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
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
    btnContainer: {
      flexShrink: 1,
      display: 'flex',
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      maxWidth: '100%',
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
  });
