import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import * as Yup from 'yup';

import { BottomSheetModalConfirmContainer } from '@/components/customized/BottomSheetModalConfirmContainer';

import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { FormInput } from '@/components/Form/Input';
import { useFormik } from 'formik';
import { useAlias2 } from '@/hooks/alias';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';

const strLength = (str: string) => {
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 0x0001 && c <= 0x007e) || (0xff60 <= c && c <= 0xff9f)) {
      len++;
    } else {
      len += 2;
    }
  }
  return len;
};

interface EditContactModalProps {
  onOk: (result: { address: string; name: string }) => void;
  onCancel(): void;
  address: string;
}

export function ModalEditContact({
  address,
  onOk,
  onCancel,
}: EditContactModalProps & {}) {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const inputRef = useRef<TextInput>(null);

  const { adderssAlias, updateAlias, fetchAlias } = useAlias2(address, {
    autoFetch: true,
  });

  const yupSchema = useMemo(() => {
    return Yup.object({
      addressAlias: Yup.string().required('Please enter address note'),
    });
  }, []);

  const formik = useFormik({
    initialValues: { addressAlias: adderssAlias || '' },
    validationSchema: yupSchema,
    validateOnMount: true,
    validateOnBlur: true,
    onSubmit: async values => {
      updateAlias(values.addressAlias);
      const latestVal = fetchAlias() || values.addressAlias;
      onOk?.({
        address,
        name: latestVal,
      });
    },
  });

  const { setFieldValue, errors, validateForm, handleSubmit } = formik;

  useEffect(() => {
    toggleShowSheetModal(!!address || 'destroy');
  }, [toggleShowSheetModal, address]);

  useEffect(() => {
    if (address) {
      setFieldValue('addressAlias', adderssAlias || '');
    }
  }, [address, adderssAlias, setFieldValue]);

  const canConfirm = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const onConfirm = useCallback(async () => {
    const errors = await validateForm();

    if (errors.addressAlias) {
      return false;
    }

    handleSubmit();
  }, [validateForm, handleSubmit]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      return !address;
    }, [address]),
  );
  useFocusEffect(onHardwareBackHandler);

  return (
    <BottomSheetModalConfirmContainer
      ref={sheetModalRef}
      bottomSheetModalProps={{
        keyboardBehavior: 'interactive',
        keyboardBlurBehavior: 'restore',
        // handleHeight: 0,
        handleComponent: null,
      }}
      onCancel={onCancel}
      height={250}
      confirmButtonProps={{
        type: 'primary',
        disabled: !canConfirm,
      }}
      onConfirm={onConfirm}>
      <View style={styles.mainContainer}>
        <Text style={styles.title}>
          {t('component.Contact.EditModal.title')}
        </Text>

        <View style={styles.formWrapper}>
          <View style={styles.inputWrapper}>
            <FormInput
              ref={inputRef}
              as={'BottomSheetTextInput'}
              style={styles.inputContainer}
              inputStyle={styles.input}
              hasError={
                !!formik.touched.addressAlias && !!formik.errors.addressAlias
              }
              inputProps={{
                autoFocus: true,
                value: formik.values.addressAlias,
                onChangeText: value => {
                  if (strLength(value) > 24) {
                    return;
                  }
                  formik.setFieldValue('addressAlias', value);
                },
                onBlur: formik.handleBlur('addressAlias'),
                placeholder: 'Enter Address Note',
                placeholderTextColor: colors['neutral-foot'],
              }}
            />
            {formik.touched.addressAlias && formik.errors.addressAlias && (
              <Text style={{ color: colors['red-default'], marginTop: 8 }}>
                {formik.errors.addressAlias}
              </Text>
            )}
          </View>
        </View>
      </View>
    </BottomSheetModalConfirmContainer>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    mainContainer: {
      height: '100%',
      width: '100%',
      alignItems: 'center',
    },
    title: {
      color: colors['neutral-title1'],
      textAlign: 'center',
      fontSize: 24,
      fontStyle: 'normal',
      fontWeight: '500',
    },
    formWrapper: {
      marginTop: 12,
      paddingHorizontal: 20,

      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    formFieldLabel: {
      justifyContent: 'flex-start',
      color: colors['neutral-foot'],
      textAlign: 'left',
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: '400',

      marginBottom: 8,
    },

    inputWrapper: {
      width: '100%',
    },
    inputContainer: {
      borderRadius: 4,

      height: 52,
    },
    input: {
      backgroundColor: colors['neutral-card2'],
      fontSize: 14,
    },

    addressLine: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    address: {
      color: colors['neutral-title1'],
      fontSize: 13,
      fontStyle: 'normal',
      fontWeight: '500',
    },
    copyIcon: {
      marginLeft: 4,
    },
  };
});
