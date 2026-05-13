import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Yup from 'yup';

import { Button } from '@/components2024/Button';
import { AppBottomSheetModal } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { NextInput } from '@/components2024/Form/Input';
import { Text } from '@/components/Typography';
import {
  getFormikErrorsCount,
  useAppFormik,
  validateFormikSchema,
} from '@/utils/patch';
import YesIcon from '@/assets2024/icons/common/check.svg';
import RcIconLock from '@/assets2024/icons/common/lock-cc.svg';
import { useTranslation } from 'react-i18next';

export type SetPasswordBottomSheetProps = {
  visible: boolean;
  onConfirm(password: string): Promise<void>;
  onClose(): void;
  loading?: boolean;
};

const SetPasswordBottomSheet: React.FC<SetPasswordBottomSheetProps> = ({
  visible,
  onConfirm,
  onClose,
  loading = false,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const insets = useSafeAreaInsets();
  const sheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [visible]);

  const yupSchema = useMemo(() => {
    const passSchema = Yup.string()
      .required(t('page.createPassword.passwordRequired'))
      .min(8, t('page.nextComponent.createNewAddress.passwordMin'));

    return Yup.object({
      password: passSchema,
      confirmPassword: Yup.string().when('password', {
        is: (password: string) => passSchema.isValidSync(password),
        then: schema =>
          schema
            .required(t('page.createPassword.confirmRequired'))
            .oneOf(
              [Yup.ref('password')],
              t('page.createPassword.confirmError'),
            ),
      }),
    });
  }, [t]);

  const formik = useAppFormik({
    initialValues: { password: '', confirmPassword: '' },
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnChange: false,
    onSubmit: async values => {
      const errors = formik.validateFormValues();
      if (getFormikErrorsCount(errors)) return;
      await onConfirm(values.password);
    },
  });

  const handleConfirm = useCallback(() => {
    const validationResult = formik.validateFormValues();
    if (getFormikErrorsCount(validationResult)) return;
    formik.handleSubmit();
  }, [formik]);

  const validationErrors = useMemo(
    () => validateFormikSchema(formik.values, yupSchema),
    [formik.values, yupSchema],
  );

  const isFormValueValid = !getFormikErrorsCount(validationErrors);
  const shouldDisabled = !isFormValueValid || loading;

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      index={0}
      enableDynamicSizing={true}
      enableContentPanningGesture={false}
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <BottomSheetView
        style={[styles.container, { paddingBottom: insets.bottom || 20 }]}>
        <Text style={styles.title}>
          {t('page.createPassword.title', 'Set Password')}
        </Text>
        <Text style={styles.subtitle}>
          {t(
            'page.createPassword.subTitle',
            'This password unlocks your wallet and encrypts your data on this device. It cannot be recovered. If lost, you will need to reset and re-import your wallet.',
          )}
        </Text>

        <View style={styles.inputGroup}>
          <View style={styles.inputFieldWrap}>
            <NextInput.Password
              as={'BottomSheetTextInput'}
              fieldName={t('page.createPassword.Newpassword')}
              containerStyle={styles.inputStyle}
              inputStyle={styles.inputPadding}
              fieldNameStyle={styles.fieldNameStyle}
              inputProps={{
                value: formik.values.password,
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: '',
                onChangeText(text) {
                  formik.setFieldValue('password', text, true);
                },
              }}
              hasError={Boolean(formik.errors.password)}
              tipText={
                formik.errors.password ||
                t('page.nextComponent.createNewAddress.passwordMin')
              }
              tipIcon={
                !formik.errors.password &&
                formik.values.password && <YesIcon width={12} height={12} />
              }
            />
          </View>

          <View style={styles.inputFieldWrap}>
            <NextInput.Password
              as={'BottomSheetTextInput'}
              fieldName={t('page.createPassword.ConfirmPassword')}
              containerStyle={styles.inputStyle}
              inputStyle={styles.inputPadding}
              fieldNameStyle={styles.fieldNameStyle}
              inputProps={{
                value: formik.values.confirmPassword,
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: '',
                onChangeText(text) {
                  formik.setFieldValue('confirmPassword', text, true);
                },
              }}
              hasError={Boolean(
                formik.values.confirmPassword && formik.errors.confirmPassword,
              )}
              tipText={
                formik.values.confirmPassword && !formik.errors.password
                  ? formik.errors.confirmPassword ||
                    t('page.nextComponent.createNewAddress.confirmPasswordTips')
                  : undefined
              }
              tipIcon={
                !formik.errors.password &&
                formik.values.password &&
                !formik.errors.confirmPassword &&
                formik.values.confirmPassword && (
                  <YesIcon width={12} height={12} />
                )
              }
            />
          </View>
        </View>

        <Button
          disabled={shouldDisabled}
          loading={loading}
          containerStyle={styles.btnContainer}
          type="primary"
          height={52}
          titleStyle={{ fontSize: 18 }}
          title={t('global.Confirm')}
          onPress={handleConfirm}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

export default SetPasswordBottomSheet;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  subtitle: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: 'SF Pro Rounded',
  },
  inputGroup: {
    marginTop: 30,
    flexDirection: 'column',
    gap: 24,
  },
  inputFieldWrap: {
    height: 76,
  },
  inputStyle: {
    borderWidth: 0,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
  },
  inputPadding: {
    paddingLeft: 16,
  },
  fieldNameStyle: {
    left: 16,
  },
  btnContainer: {
    width: '100%',
    marginTop: 30,
  },
}));
