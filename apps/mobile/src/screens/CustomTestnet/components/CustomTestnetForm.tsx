import { FormInput } from '@/components/Form/Input';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';

const FormItem = ({
  disabled,
  formik,
  style,
  name,
  label,
  autoFocus,
}: {
  disabled?: boolean;
  formik: ReturnType<typeof useCustomTestnetForm>;
  style?: StyleProp<ViewStyle>;
  name: string;
  label?: string;
  autoFocus?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const formInputRef = useRef<TextInput>(null);
  const val = formik.values[name];
  const value = isNumber(val) ? val.toString() : val;

  return (
    <View style={[styles.formItem, style]}>
      <Text style={styles.formLabel}>{label}</Text>
      <FormInput
        style={disabled ? { borderWidth: 0 } : null}
        inputStyle={[styles.input, disabled ? styles.inputDisabled : null]}
        // className="mt-[8]"
        // containerStyle={styles.inputContainer}
        ref={formInputRef}
        // disableFocusingStyle
        // inputStyle={styles.input}
        hasError={!!formik.errors[name]}
        inputProps={{
          // ...inputProps,
          autoFocus,
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

export const CustomTestnetForm = ({
  // form,
  isEdit,
  disabled,
  idDisabled,
  onFieldsChange,
  formik,
}: {
  // form: FormInstance<TestnetChainBase>;
  isEdit?: boolean;
  disabled?: boolean;
  idDisabled?: boolean;
  onFieldsChange?(changedFields: any, allFields: any): void;
  formik: ReturnType<typeof useCustomTestnetForm>;
}) => {
  const { t } = useTranslation();
  // const inputRef = React.useRef<Input>(null);

  // useMount(() => {
  //   setTimeout(() => {
  //     inputRef?.current?.focus();
  //   });
  // });

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      enableOnAndroid
      scrollEnabled
      keyboardOpeningTime={0}
      keyboardShouldPersistTaps="handled">
      <View>
        <FormItem
          name="id"
          label={t('page.customTestnet.CustomTestnetForm.id')}
          formik={formik}
          disabled={disabled || isEdit || idDisabled}
          autoFocus
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.name')}
          name="name"
          formik={formik}
          disabled={disabled}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.rpcUrl')}
          name="rpcUrl"
          formik={formik}
          disabled={disabled}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.nativeTokenSymbol')}
          name="nativeTokenSymbol"
          formik={formik}
          disabled={disabled}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.blockExplorerUrl')}
          name="scanLink"
          formik={formik}
          disabled={disabled}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {},
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
  });
