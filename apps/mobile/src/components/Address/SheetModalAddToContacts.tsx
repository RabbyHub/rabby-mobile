import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import * as Yup from 'yup';

import { BottomSheetModalConfirmContainer } from '@/components/customized/BottomSheetModalConfirmContainer';

import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { FormInput } from '@/components/Form/Input';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { useFormik } from 'formik';
import { apisAddress } from '@/core/apis';
import { useAlias } from '@/hooks/alias';
import { toast, toastWithIcon } from '@/components/Toast';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';

interface AddToContactsModalProps {
  onFinished: (result: {
    addressAlias: string;
    contactAddrAdded: string;
  }) => void;
  onCancel(): void;
}

export function ModalAddToContacts({
  addrToAdd,
  onFinished,
  onCancel,
}: AddToContactsModalProps & {
  addrToAdd: string;
}) {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const inputRef = useRef<TextInput>(null);

  const yupSchema = useMemo(() => {
    return Yup.object({
      addressAlias: Yup.string().required(
        t('page.sendToken.AddToContactsModal.editAddr.validator__empty'),
      ),
    });
  }, [t]);

  const [aliasName, updateAlias] = useAlias(addrToAdd);

  const formik = useFormik({
    initialValues: { addressAlias: aliasName || '' },
    validationSchema: yupSchema,
    validateOnMount: true,
    validateOnBlur: true,
    onSubmit: async values => {
      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))(`Adding contact`, {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      try {
        await apisAddress.addWatchAddress(addrToAdd);
        toast.success(t('page.sendToken.AddToContactsModal.addedAsContacts'));

        updateAlias(values.addressAlias);

        onFinished?.({
          addressAlias: values.addressAlias,
          contactAddrAdded: addrToAdd,
        });
      } catch (err) {
        toast.show('Error occured on adding address to contacts');
      } finally {
        toastHide();
      }
    },
  });

  const { setFieldValue, resetForm, errors, validateForm, handleSubmit } =
    formik;

  useEffect(() => {
    toggleShowSheetModal(!!addrToAdd || 'destroy');
  }, [toggleShowSheetModal, addrToAdd]);

  useEffect(() => {
    if (addrToAdd) {
      setFieldValue('addressAlias', aliasName || '');
    }
  }, [addrToAdd, resetForm, aliasName, setFieldValue]);

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
      return !addrToAdd;
    }, [addrToAdd]),
  );
  useFocusEffect(onHardwareBackHandler);

  return (
    <BottomSheetModalConfirmContainer
      ref={sheetModalRef}
      bottomSheetModalProps={{
        keyboardBehavior: 'interactive',
        keyboardBlurBehavior: 'restore',
        // @ts-expect-error we need to double check if it could be removed
        handleHeight: 0,
        handleComponent: null,
      }}
      onCancel={onCancel}
      noCancelButton
      height={310}
      confirmButtonProps={{
        type: 'primary',
        disabled: !canConfirm,
      }}
      onConfirm={onConfirm}>
      <View style={styles.mainContainer}>
        <Text style={styles.title}>
          {t('page.sendToken.modalConfirmAddToContacts.title')}
        </Text>

        <View style={styles.formWrapper}>
          <Text style={styles.formFieldLabel}>
            {t('page.sendToken.AddToContactsModal.editAddressNote')}
          </Text>
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
                onChangeText: formik.handleChange('addressAlias'),
                onBlur: formik.handleBlur('addressAlias'),
                placeholder: t(
                  'page.sendToken.AddToContactsModal.editAddr.placeholder',
                ),
                placeholderTextColor: colors['neutral-foot'],
              }}
            />
            {formik.touched.addressAlias && formik.errors.addressAlias && (
              <Text style={{ color: colors['red-default'], marginTop: 8 }}>
                {formik.errors.addressAlias}
              </Text>
            )}
          </View>
          <View style={styles.addressLine}>
            <Text style={styles.address}>{addrToAdd}</Text>
            <CopyAddressIcon address={addrToAdd} style={styles.copyIcon} />
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
