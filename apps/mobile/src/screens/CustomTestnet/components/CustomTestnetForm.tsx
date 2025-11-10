import { FormInput } from '@/components/Form/Input';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { isNumber } from 'lodash';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Gesture,
  GestureDetector,
  Pressable,
} from 'react-native-gesture-handler';

const FormItem = ({
  disabled,
  formik,
  style,
  name,
  label,
  __IN_BOTTOM_SHEET__ = true,
}: {
  disabled?: boolean;
  formik: ReturnType<typeof useCustomTestnetForm>;
  style?: StyleProp<ViewStyle>;
  name: string;
  label?: string;
  __IN_BOTTOM_SHEET__?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle: getFormItemStyles });
  const formInputRef = useRef<TextInput>(null);
  const val = formik.values[name];
  const value = isNumber(val) ? val.toString() : val;

  return (
    <View style={[styles.formItem, style]}>
      <Text style={styles.formLabel}>{label}</Text>
      <FormInput
        as={__IN_BOTTOM_SHEET__ ? 'BottomSheetTextInput' : 'TextInput'}
        disableNestedTouchEventOnAndroid={__IN_BOTTOM_SHEET__}
        style={disabled ? { borderWidth: 0 } : null}
        inputStyle={[styles.input, disabled ? styles.inputDisabled : null]}
        ref={formInputRef}
        hasError={!!formik.errors[name]}
        inputProps={{
          autoFocus: false,
          numberOfLines: 1,
          multiline: false,
          value: value,
          editable: !disabled,
          onChangeText: value => {
            formik.setFieldValue(name, value);
            setTimeout(() => {
              formik.validateField(name);
            }, 20);
          },
          onBlur: e => {
            formik.handleBlur(name)(e);
            formik.validateField(name);
          },
        }}
      />
      {formik.errors[name] ? (
        <View style={styles.formItemExtra}>
          <Text style={styles.formItemError}>{formik.errors[name]}</Text>
        </View>
      ) : null}
    </View>
  );
};

const getFormItemStyles = createGetStyles2024(({ colors }) => {
  return {
    input: {
      height: 52,
      borderRadius: 6,
      color: colors['neutral-title-1'],
      fontWeight: '500',
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
  };
});

export const CustomTestnetForm = ({
  isEdit,
  disabled,
  idDisabled,
  formik,
  __IN_BOTTOM_SHEET__ = false,
}: {
  isEdit?: boolean;
  disabled?: boolean;
  idDisabled?: boolean;
  formik: ReturnType<typeof useCustomTestnetForm>;
  __IN_BOTTOM_SHEET__?: boolean;
}) => {
  const { t } = useTranslation();

  // const {colors, styles} = useTheme2024({ getStyle: getStyles });

  return (
    <>
      <FormItem
        name="id"
        label={t('page.customTestnet.CustomTestnetForm.id')}
        formik={formik}
        disabled={disabled || isEdit || idDisabled}
        __IN_BOTTOM_SHEET__={__IN_BOTTOM_SHEET__}
      />
      <FormItem
        label={t('page.customTestnet.CustomTestnetForm.name')}
        name="name"
        formik={formik}
        disabled={disabled}
        __IN_BOTTOM_SHEET__={__IN_BOTTOM_SHEET__}
      />
      <FormItem
        label={t('page.customTestnet.CustomTestnetForm.rpcUrl')}
        name="rpcUrl"
        formik={formik}
        disabled={disabled}
        __IN_BOTTOM_SHEET__={__IN_BOTTOM_SHEET__}
      />
      <FormItem
        label={t('page.customTestnet.CustomTestnetForm.nativeTokenSymbol')}
        name="nativeTokenSymbol"
        formik={formik}
        disabled={disabled}
        __IN_BOTTOM_SHEET__={__IN_BOTTOM_SHEET__}
      />
      <FormItem
        label={t('page.customTestnet.CustomTestnetForm.blockExplorerUrl')}
        name="scanLink"
        formik={formik}
        disabled={disabled}
        __IN_BOTTOM_SHEET__={__IN_BOTTOM_SHEET__}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors }) => {
  return {
    container: {
      height: '100%',
    },
  };
});
