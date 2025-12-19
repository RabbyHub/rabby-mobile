/* eslint-disable react-native/no-inline-styles */
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useEffect } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import * as Yup from 'yup';
import { RootNames } from '@/constant/layout';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NextInput } from '@/components2024/Form/Input';
import { ProgressBar } from '@/components2024/progressBar';
import { Button } from '@/components2024/Button';
import { apisLock } from '@/core/apis';
import { APP_FEATURE_SWITCH, APP_TEST_PWD } from '@/constant';
import { getFormikErrorsCount, useAppFormik } from '@/utils/patch';
import { toast, toastWithIcon } from '@/components2024/Toast';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import TouchableView from '@/components/Touchable/TouchableView';
import { CheckBoxRect } from '@/components2024/CheckBox';
import TouchableText from '@/components/Touchable/TouchableText';
import { useShowUserAgreementLikeModal } from '../ManagePassword/components/UserAgreementLikeModalInner2024';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { useBiometrics } from '@/hooks/biometrics';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import YesIcon from '@/assets2024/icons/common/check.svg';
import {
  useCreateAddressProc,
  useImportAddressProc,
} from '@/hooks/address/useNewUser';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { AddressNavigatorParamList } from '@/navigation-type';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { stats } from '@/utils/stats';
import { IS_IOS } from '@/core/native/utils';

const INIT_FORM_DATA = __DEV__
  ? {
      password: APP_TEST_PWD,
      confirmPassword: APP_TEST_PWD,
      checked: true,
      switch: false,
    }
  : { password: '', confirmPassword: '', checked: true, switch: false };

const DISABLE_SET_PASSWORD = !APP_FEATURE_SWITCH.customizePassword;

function useSetupPasswordForm(
  toggleBiometrics: ReturnType<typeof useBiometrics>['toggleBiometrics'],
  finishGoToScreen: (AddressNavigatorParamList['SetPassword2024'] &
    object)['finishGoToScreen'],
  isBiometricsEnabled: boolean,
  delaySetPassword?: boolean,
  isFirstImportPassword?: boolean,
  isFirstCreate?: boolean,
) {
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

  const navigation = useRabbyAppNavigation();

  const { storePassword } = useCreateAddressProc();
  const { confirmCB, resetImportAddressProc } = useImportAddressProc();

  const formik = useAppFormik({
    initialValues: yupSchema.getDefault(),
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnChange: false,
    onSubmit: async values => {
      const errors = formik.validateFormValues();

      if (getFormikErrorsCount(errors)) {
        return;
      }

      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))(t('page.createPassword.settingUp'), {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      storePassword({
        password: values.password,
        confirmPassword: values.confirmPassword,
        enableBiometrics: values.switch,
      });

      const updatePassword = async () => {
        const result = await apisLock.resetPasswordOnUI(values.password);
        if (result.error) {
          toast.show(result.error);
          return false;
        } else {
          try {
            await toggleBiometrics?.(values.switch, {
              validatedPassword: values.password,
            });
            return true;
          } catch (e) {
            console.log('toggleBiometrics error', e);
            toast.show(t('page.createPassword.biometricsFail'));
          }
        }
      };

      try {
        if (delaySetPassword && !isFirstImportPassword) {
          toastHide();
          navigation.replace(RootNames.StackAddress, {
            screen: RootNames.CreateChooseBackup,
            params: {
              delaySetPassword: true,
              isFirstCreate: !!isFirstCreate,
            },
          });
        } else {
          const success = await updatePassword();
          if (success) {
            toast.success(t('page.createPassword.setUpSuccess'));
          } else {
            return; // error to reset password
          }
          if (isFirstImportPassword) {
            await confirmCB?.();
            resetImportAddressProc();
          } else {
            navigation.replace(RootNames.StackAddress, {
              screen: finishGoToScreen,
            });
          }
        }
      } finally {
        toastHide();

        preferenceService.setReportActionTs(
          REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE,
        );
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
  const { viewTermsOfUse, viewPrivacyPolicy } = useShowUserAgreementLikeModal();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'AddressNavigatorParamList', 'SetPassword2024'>
    >();
  const state = route.params;
  if (!state) {
    throw new Error('[SetPassword2024] state is undefined');
  }
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const {
    computed: { defaultTypeLabel, isBiometricsEnabled, couldSetupBiometrics },
    fetchBiometrics,
    toggleBiometrics,
  } = useBiometrics({ autoFetch: true });

  const { formik, shouldDisabled } = useSetupPasswordForm(
    toggleBiometrics,
    state.finishGoToScreen,
    isBiometricsEnabled,
    state.delaySetPassword,
    state.isFirstImportPassword,
    state.isFirstCreate,
  );

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText2024 style={styles.headerTitleStyle}>
        {state.title || t('screens.addressStackTitle.SetPassword2024')}
      </HeaderTitleText2024>
    );
  }, [state.title, styles.headerTitleStyle, t]);

  React.useEffect(() => {
    setNavigationOptions(
      Object.assign(
        {
          headerTitle: getHeaderTitle,
        },
        state.hideBackIcon
          ? {
              headerLeft: () => null,
            }
          : {},
      ),
    );
  }, [setNavigationOptions, getHeaderTitle, state.title, state.hideBackIcon]);

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
        {(!state.hideProgress || state?.isFirstCreate) && (
          <ProgressBar amount={3} currentCount={2} />
        )}
        <Text style={[styles.text]}>
          {t('page.nextComponent.createNewAddress.passwordTopTips')}
        </Text>
        <View style={styles.bodyContainer}>
          <View style={styles.formWrapper}>
            <View style={styles.inputHorizontalGroup}>
              <NextInput.Password
                // initialPasswordVisible
                ref={passwordInputRef}
                fieldName={t('page.createPassword.Newpassword')}
                fieldNameStyle={styles.absoluteLeft}
                inputStyle={styles.paddingLeft}
                containerStyle={styles.inputStyle}
                inputProps={{
                  ...(DISABLE_SET_PASSWORD && {
                    editable: false,
                    selectTextOnFocus: false,
                  }),
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

              <NextInput.Password
                fieldName={t('page.createPassword.ConfirmPassword')}
                ref={confirmPasswordInputRef}
                style={{ marginTop: 20 }}
                containerStyle={styles.inputStyle}
                fieldNameStyle={styles.absoluteLeft}
                inputStyle={styles.paddingLeft}
                inputProps={{
                  ...(DISABLE_SET_PASSWORD && {
                    editable: false,
                    selectTextOnFocus: false,
                  }),
                  value: formik.values.confirmPassword,
                  secureTextEntry: true,
                  inputMode: 'text',
                  returnKeyType: 'done',
                  placeholder: '',
                  placeholderTextColor: colors2024['neutral-foot'],
                  onChangeText(text) {
                    formik.setFieldValue('confirmPassword', text, true);
                  },
                }}
                hasError={Boolean(
                  formik.values.confirmPassword &&
                    formik.errors.confirmPassword,
                )}
                tipText={
                  (formik.values.confirmPassword &&
                    formik.errors.confirmPassword) ||
                  t('page.nextComponent.createNewAddress.confirmPasswordTips')
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
            <View style={styles.switchContainer}>
              <Text style={styles.labelText}>
                {t('page.createPassword.enable', { bioType: defaultTypeLabel })}
              </Text>
              <View style={styles.valueView}>
                <AppSwitch2024
                  value={formik.values.switch}
                  onValueChange={async value => {
                    if (!couldSetupBiometrics) {
                      toast.show(
                        t('page.createPassword.phoneNotSupport', {
                          bioType: defaultTypeLabel,
                        }),
                      );
                      return;
                    }
                    formik.setFieldValue('switch', value, true);
                  }}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.agreementWrapper}
              onPress={() => {
                formik.setFieldValue('checked', !formik.values.checked, true);
              }}>
              <View style={styles.agreementCheckbox}>
                <CheckBoxRect checked={formik.values.checked} />
              </View>
              <View style={styles.agreementTextWrapper}>
                <Text style={styles.agreementText}>
                  {t('page.createPassword.agreeToTerms')}{' '}
                </Text>
                <TouchableText
                  style={styles.userAgreementTouchText}
                  touchableProps={{ style: styles.userAgreementTouchable }}
                  onPress={evt => {
                    evt.stopPropagation();
                    viewTermsOfUse();
                  }}>
                  {t('page.createPassword.termOfUse')}
                </TouchableText>
                <Text style={styles.agreementText}>
                  {' ' + t('page.createPassword.and') + ' '}
                </Text>
                <TouchableText
                  style={styles.userAgreementTouchText}
                  touchableProps={{ style: styles.userAgreementTouchable }}
                  onPress={evt => {
                    evt.stopPropagation();
                    viewPrivacyPolicy();
                  }}>
                  {t('page.createPassword.PrivacyPolicy')}
                </TouchableText>
              </View>
            </TouchableOpacity>
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
  const { colors2024 } = useTheme2024({ getStyle });
  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-1'],
      }}>
      <MainListBlocks />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 56,
  },
  inputStyle: {
    borderWidth: 0,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 34,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  paddingLeft: {
    paddingLeft: 16,
  },
  absoluteLeft: {
    left: 16,
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
    marginTop: 24,
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
    backgroundColor: colors2024['neutral-bg-1'],
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
    bottom: 104,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    paddingHorizontal: 30,
    width: '100%',
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
    flexWrap: 'wrap',
  },
  agreementText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  userAgreementTouchText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  userAgreementTouchable: {
    padding: 0,
    // position: 'relative',
    // top: 0,
    // ...makeDebugBorder(),
  },
  headerTitleStyle: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },
}));

export default SetPassword2024;
