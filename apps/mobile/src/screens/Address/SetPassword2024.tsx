import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useEffect } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import * as Yup from 'yup';
import { RootNames } from '@/constant/layout';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NextInput } from '@/components2024/Form/Input';
import { ProgressBar } from '@/components2024/progressBar';
import { Button } from '@/components2024/Button';
import { apisLock } from '@/core/apis';
import { APP_FEATURE_SWITCH, APP_TEST_PWD } from '@/constant';
import { IS_IOS } from '@/core/native/utils';
import { getFormikErrorsCount, useAppFormik } from '@/utils/patch';
import { toast, toastWithIcon } from '@/components/Toast';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import TouchableView from '@/components/Touchable/TouchableView';
import { CheckBoxRect } from '@/components2024/CheckBox';
import TouchableText from '@/components/Touchable/TouchableText';
import { useShowUserAgreementLikeModal } from '../ManagePassword/components/UserAgreementLikeModalInner';
import { AppSwitch } from '@/components';
import { useBiometrics } from '@/hooks/biometrics';
import { useLoadLockInfo } from '@/hooks/useLock';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';

const INIT_FORM_DATA = __DEV__
  ? {
      password: APP_TEST_PWD,
      confirmPassword: APP_TEST_PWD,
      checked: true,
      switch: false,
    }
  : { password: '', confirmPassword: '', checked: true, switch: false };

const DISABLE_SET_PASSWORD = !APP_FEATURE_SWITCH.customizePassword;

function useSetupPasswordForm(toggleBiometrics, onFinish, isBiometricsEnabled) {
  const { t } = useTranslation();
  const yupSchema = React.useMemo(() => {
    const passSchema = Yup.string()
      .default(INIT_FORM_DATA.password)
      .required(t('page.createPassword.passwordRequired'))
      .min(8, t('page.nextComponent.createNewAddress.passwordMin'));
    return Yup.object({
      password: passSchema,
      confirmPassword: Yup.string()
        .default(INIT_FORM_DATA.confirmPassword)
        .when('password', {
          is: (password: string) => {
            return passSchema.isValidSync(password);
          },
          then: schema =>
            schema
              .required(t('page.createPassword.confirmRequired'))
              .oneOf(
                [Yup.ref('password')],
                t('page.createPassword.confirmError'),
              ),
        }),
      switch: Yup.boolean().default(isBiometricsEnabled),
      checked: Yup.boolean().default(INIT_FORM_DATA.checked).oneOf([true]),
    });
  }, [t, isBiometricsEnabled]);

  // const navigation = useRabbyAppNavigation();
  // const navParams = useNavigationState(
  //   s => s.routes.find(r => r.name === RootNames.SetPassword)?.params,
  // ) as SettingNavigatorParamList['SetPassword'] | undefined;

  // const { updateSetPasswordFirst } = useSetPasswordFirstState();

  const { fetchLockInfo } = useLoadLockInfo();

  const formik = useAppFormik({
    initialValues: yupSchema.getDefault(),
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnChange: false,
    onSubmit: async (values, helpers) => {
      const errors = formik.validateFormValues();

      if (getFormikErrorsCount(errors)) {
        return;
      }

      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))('Setting up password', {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      try {
        // await clearCustomPassword(values.password); // only for test
        const result = await apisLock.setupWalletPassword(values.password);
        if (result.error) {
          toast.show(result.error);
        } else {
          await fetchLockInfo();
          await toggleBiometrics?.(values.switch, {
            validatedPassword: values.password,
          });

          onFinish();
          toast.success('Setup Password Successfully');
        }
      } finally {
        toastHide();
      }
    },
  });

  const shouldDisabled =
    !formik.values.checked ||
    !!getFormikErrorsCount(formik.validateFormValues());

  return { formik, shouldDisabled: shouldDisabled || DISABLE_SET_PASSWORD };
}

function MainListBlocks() {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { viewTermsOfUse } = useShowUserAgreementLikeModal();

  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SetPassword2024)?.params,
  ) as {
    onFinish: () => {};
    title: string;
    hideProgress: boolean;
  };
  console.log('state2', state);
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const {
    computed: {
      couldSetupBiometrics,
      isBiometricsEnabled,
      isFaceID,
      defaultTypeLabel,
    },
    fetchBiometrics,
    toggleBiometrics,
  } = useBiometrics({ autoFetch: true });
  const { formik, shouldDisabled } = useSetupPasswordForm(
    toggleBiometrics,
    state.onFinish,
    isBiometricsEnabled,
  );

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  useEffect(() => {
    if (!state.title) {
      return;
    }
    setNavigationOptions({
      title: state.title,
    });
  }, [setNavigationOptions, state.title]);

  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText>{state.title || '2. set password'}</HeaderTitleText>
    );
  }, [state.title]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle, state.title]);

  const passwordInputRef = React.useRef<TextInput>(null);
  const confirmPasswordInputRef = React.useRef<TextInput>(null);

  const { onTouchInputAway } = useInputBlurOnTouchaway([
    passwordInputRef,
    confirmPasswordInputRef,
  ]);

  const handleContinue = useCallback(() => {
    const validationResult = formik.validateFormValues();
    if (getFormikErrorsCount(validationResult)) {
      return;
    }

    formik.handleSubmit();
  }, [formik]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
        onTouchInputAway();
      }}>
      <View style={[styles.container]}>
        {!state.hideProgress && <ProgressBar amount={3} currentCount={2} />}
        <Text style={[styles.text]}>
          {t('page.nextComponent.createNewAddress.passwordTopTips')}
        </Text>
        <View style={styles.bodyContainer}>
          <View style={styles.formWrapper}>
            <View style={styles.inputHorizontalGroup}>
              <NextInput.Password
                // initialPasswordVisible
                ref={passwordInputRef}
                fieldName="New password"
                inputProps={{
                  ...(DISABLE_SET_PASSWORD && {
                    editable: false,
                    selectTextOnFocus: false,
                  }),
                  value: formik.values.password,
                  secureTextEntry: true,
                  inputMode: 'text',
                  returnKeyType: 'done',
                  placeholder: t('page.createPassword.passwordPlaceholder'),
                  placeholderTextColor: colors2024['neutral-foot'],
                  onChangeText(text) {
                    formik.setFieldValue('password', text, true);
                  },
                }}
                hasError={Boolean(formik.errors.password)}
                tipText={formik.errors.password}
              />

              <NextInput.Password
                fieldName="Confirm password"
                ref={confirmPasswordInputRef}
                style={{ marginTop: 20 }}
                inputProps={{
                  ...(DISABLE_SET_PASSWORD && {
                    editable: false,
                    selectTextOnFocus: false,
                  }),
                  value: formik.values.confirmPassword,
                  secureTextEntry: true,
                  inputMode: 'text',
                  returnKeyType: 'done',
                  placeholder: t(
                    'page.createPassword.confirmPasswordPlaceholder',
                  ),
                  placeholderTextColor: colors2024['neutral-foot'],
                  onChangeText(text) {
                    formik.setFieldValue('confirmPassword', text, true);
                  },
                }}
                hasError={Boolean(formik.errors.confirmPassword)}
                tipText={formik.errors.confirmPassword}
              />
            </View>
            <View style={styles.switchContainer}>
              <Text
                style={styles.labelText}>{`Enable ${defaultTypeLabel}?`}</Text>
              <View style={styles.valueView}>
                <AppSwitch
                  value={formik.values.switch}
                  onValueChange={value => {
                    if (!couldSetupBiometrics) {
                      toast.show(
                        `your phone can not support ${defaultTypeLabel}`,
                      );
                      return;
                    }
                    formik.setFieldValue('switch', value, true);
                  }}
                />
              </View>
            </View>
            <TouchableView
              style={styles.agreementWrapper}
              onPress={() => {
                formik.setFieldValue('checked', !formik.values.checked, true);
              }}>
              <View style={styles.agreementCheckbox}>
                <CheckBoxRect checked={formik.values.checked} />
              </View>
              <View style={styles.agreementTextWrapper}>
                {/* <Trans i18nKey="page.createPassword.agree" t={t}>
                </Trans> */}
                <Text style={styles.agreementText}>
                  I have read and agree to the{' '}
                </Text>
                <TouchableText
                  style={styles.userAgreementTouchText}
                  touchableProps={{ style: styles.userAgreementTouchable }}
                  onPress={evt => {
                    evt.stopPropagation();
                    viewTermsOfUse();
                  }}>
                  Term of Use
                </TouchableText>
              </View>
            </TouchableView>
          </View>
        </View>
        <Button
          disabled={shouldDisabled}
          containerStyle={styles.btnContainer}
          type="primary"
          title={t('page.nextComponent.createNewAddress.Continue')}
          onPress={handleContinue}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

function SetPassword2024(): JSX.Element {
  return (
    <NormalScreenContainer>
      <MainListBlocks />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 60,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 34,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  labelText: {
    width: '50%',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  valueView: {
    width: '50%',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  switchContainer: {
    // width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 36,
    paddingHorizontal: 8,
  },
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  bodyContainer: {
    // backgroundColor: colors['neutral-bg2'],
    flexShrink: 1,
    height: '100%',
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
    // ...makeDebugBorder()
  },
  formWrapper: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 10,
    flexDirection: 'column',
    // justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputHorizontalGroup: {
    width: 'auto',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  inputContainer: {
    borderRadius: 8,
    height: 56,
  },
  input: {
    backgroundColor: colors2024['neutral-bg-1'],
    fontSize: 14,
  },
  agreementWrapper: {
    position: 'absolute',
    bottom: 108,
    height: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    paddingHorizontal: 32,
  },
  agreementCheckbox: {
    marginRight: 6,
    position: 'relative',
  },
  agreementTextWrapper: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  agreementText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors2024['neutral-body'],
  },
  userAgreementTouchText: {
    fontSize: 14,
    color: colors2024['blue-default'],
  },
  userAgreementTouchable: {
    padding: 0,
    // position: 'relative',
    // top: 0,
    // ...makeDebugBorder(),
  },
}));

export default SetPassword2024;
