import { FormInput } from '@/components/Form/Input';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
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
import { ScrollView } from 'react-native-gesture-handler';
import { useCustomTestnetForm } from '../hooks/useCustomTestnetForm';

const FormItem = ({
  disabled,
  formik,
  style,
  name,
  label,
}: {
  disabled?: boolean;
  formik: ReturnType<typeof useCustomTestnetForm>;
  style?: StyleProp<ViewStyle>;
  name: string;
  label?: string;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const formInputRef = useRef<TextInput>(null);

  return (
    <View style={[styles.formItem, style]}>
      <Text style={styles.formLabel}>{label}</Text>
      <FormInput
        style={styles.input}
        // className="mt-[8]"
        // containerStyle={styles.inputContainer}
        ref={formInputRef}
        // disableFocusingStyle
        // inputStyle={styles.input}
        hasError={!!formik.errors[name]}
        inputProps={{
          // ...inputProps,
          numberOfLines: 1,
          multiline: false,
          value: formik.values[name],
          onChangeText: value => {
            formik.setFieldValue(name, value);
            setTimeout(() => {
              formik.validateField(name);
            }, 20);
          },
          onBlur: e => {
            console.log('blur', name);
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
    <ScrollView style={styles.container}>
      <View>
        <FormItem
          name="id"
          label={t('page.customTestnet.CustomTestnetForm.id')}
          formik={formik}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.name')}
          name="name"
          formik={formik}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.rpcUrl')}
          name="rpcUrl"
          formik={formik}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.nativeTokenSymbol')}
          name="nativeTokenSymbol"
          formik={formik}
        />
        <FormItem
          label={t('page.customTestnet.CustomTestnetForm.blockExplorerUrl')}
          name="scanLink"
          formik={formik}
        />
      </View>
    </ScrollView>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
    },
    input: {
      height: 52,
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
