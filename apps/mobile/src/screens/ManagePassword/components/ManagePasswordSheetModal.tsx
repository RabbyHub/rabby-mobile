import React, { useMemo, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Yup from 'yup';

import { AppBottomSheetModal, Button } from '@/components';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { PasswordStatus } from '@/core/apis/lock';
import { useSheetModalsForManagingPassword } from '../hooks';

import { useWalletPasswordInfo } from '../useManagePassword';

import { default as RcNoPassword } from '../icons/no-password.svg';
import { default as RcHasPassword } from '../icons/has-password.svg';
import { FormInput } from '@/components/Form/Input';
import { useTranslation } from 'react-i18next';
import { useFormik } from 'formik';
import { getFormikErrorsCount } from '@/utils/patch';
import { toast, toastWithIcon } from '@/components/Toast';
import { apisKeychain, apisLock } from '@/core/apis';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { useBiometrics } from '@/hooks/biometrics';
import { resetHasTipedUserEnableBiometrics } from '@/screens/Unlock/hooks';
import AutoLockView from '@/components/AutoLockView';
import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { useAccounts } from '@/hooks/account';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';

type Props = {
  height?: number;
};
const ConfirmSetupPasswordSheetModal = (props: Props) => {
  const { height = 422 } = props;

  const { sheetModalRefs, toggleShowSheetModal } =
    useSheetModalsForManagingPassword();
  const insets = useSafeAreaInsets();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cancel = () => {
    toggleShowSheetModal('setupPasswordModalRef', false);
  };
  const confirm = () => {
    toggleShowSheetModal('setupPasswordModalRef', false);
  };

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      index={0}
      ref={sheetModalRefs.setupPasswordModalRef}
      snapPoints={[height + insets.bottom]}>
      <AutoLockView
        as="BottomSheetView"
        style={[styles.container, { paddingBottom: 20 + insets.bottom }]}>
        <Text style={styles.title}>{'Setup Password'}</Text>
        <View style={styles.bodyContainer}>
          <RcNoPassword style={{ width: 40, height: 40 }} />
          <Text style={[styles.desc]}>
            {'Set up a password to lock the app and secure your data'}
          </Text>
        </View>
        <View style={styles.btnGroup}>
          <View style={styles.border} />
          <Button
            onPress={cancel}
            title={'Cancel'}
            type="clear"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnCancelTitle}
            containerStyle={[styles.btnContainer, styles.btnCancelContainer]}>
            Cancel
          </Button>
          <View style={styles.btnGap} />
          <Button
            onPress={confirm}
            title={'Confirm'}
            type="primary"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnConfirmTitle}
            containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}>
            Confirm
          </Button>
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

function useClearPasswordForm() {
  const { t } = useTranslation();
  const { toggleShowSheetModal } = useSheetModalsForManagingPassword();

  const yupSchema = React.useMemo(() => {
    return Yup.object({
      currentPassword: Yup.string()
        .required(t('page.createPassword.passwordRequired'))
        .min(8, t('page.createPassword.passwordMin')),
    });
  }, [t]);

  const { fetchLockInfo } = useWalletPasswordInfo();
  const { fetchBiometrics } = useBiometrics();

  const formik = useFormik({
    initialValues: { currentPassword: '' },
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) return;

      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))(`Clearing Password`, {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      try {
        const result = await apisKeychain.clearApplicationPassword(
          values.currentPassword,
        );
        if (result.clearCustomPasswordError) {
          toast.show(result.clearCustomPasswordError);
        } else {
          toast.success('Clear Password Successfully');
          resetHasTipedUserEnableBiometrics();
          toggleShowSheetModal('clearPasswordModalRef', false);
        }
      } finally {
        Promise.allSettled([fetchLockInfo(), fetchBiometrics()]);
        toastHide();
      }
    },
  });

  const shouldDisabled = !!getFormikErrorsCount(formik.errors);

  return { formik, shouldDisabled };
}
const CancelPasswordSheetModal = (props: Props) => {
  const { height = 422 } = props;
  const { formik, shouldDisabled } = useClearPasswordForm();

  const { sheetModalRefs, toggleShowSheetModal } =
    useSheetModalsForManagingPassword();
  const insets = useSafeAreaInsets();

  const { colors, styles } = useThemeStyles(getStyles);
  const cancel = useCallback(() => {
    formik.resetForm();
    toggleShowSheetModal('clearPasswordModalRef', false);
  }, [formik, toggleShowSheetModal]);

  const passwordInputRef = React.useRef<TextInput>(null);

  // const { onTouchInputAway } = useInputBlurOnTouchaway([passwordInputRef]);

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      index={0}
      ref={sheetModalRefs.clearPasswordModalRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      snapPoints={[height + insets.bottom]}>
      <AutoLockView
        as="BottomSheetView"
        style={[styles.container, { paddingBottom: 20 + insets.bottom }]}>
        <Text style={styles.title}>{'Clear Password'}</Text>
        <View style={styles.bodyContainer}>
          <View style={styles.descWrapper}>
            <RcHasPassword style={{ width: 40, height: 40 }} />
            <Text style={[styles.desc]}>
              {"By canceling the password setup, you can't lock the app"}
            </Text>
          </View>

          <View style={styles.formWrapper}>
            <View style={styles.inputHorizontalGroup}>
              <Text style={styles.formFieldLabel}>Current Password</Text>
              <FormInput
                as="BottomSheetTextInput"
                ref={passwordInputRef}
                style={styles.inputContainer}
                inputStyle={styles.input}
                inputProps={{
                  value: formik.values.currentPassword,
                  secureTextEntry: true,
                  inputMode: 'text',
                  returnKeyType: 'none',
                  placeholder: 'Confirm cancellation by entering your password',
                  placeholderTextColor: colors['neutral-foot'],
                  onChangeText(text) {
                    formik.setFieldValue('currentPassword', text);
                  },
                }}
                errorText={formik.errors.currentPassword}
              />
            </View>
          </View>
        </View>
        <View style={styles.btnGroup}>
          <View style={styles.border} />
          <Button
            onPress={cancel}
            title={'Cancel'}
            type="primary"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnConfirmTitle}
            containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}>
            Cancel
          </Button>
          <View style={styles.btnGap} />
          <Button
            disabled={shouldDisabled}
            onPress={formik.handleSubmit}
            title={'Confirm'}
            type="clear"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnCancelTitle}
            containerStyle={[styles.btnContainer, styles.btnCancelContainer]}>
            Confirm
          </Button>
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export function ManagePasswordSheetModal(props: Props) {
  const { lockInfo } = useWalletPasswordInfo({ autoFetch: true });

  if (lockInfo.pwdStatus === PasswordStatus.Custom) {
    return <CancelPasswordSheetModal {...props} />;
  }

  return <ConfirmSetupPasswordSheetModal {...props} />;
}

function useResetPasswordAndKeyringsForm() {
  const { t } = useTranslation();
  const { toggleShowSheetModal } = useSheetModalsForManagingPassword();

  const yupSchema = React.useMemo(() => {
    return Yup.object({
      currentPassword: Yup.string()
        .required(t('page.createPassword.passwordRequired'))
        .min(8, t('page.createPassword.passwordMin')),
    });
  }, [t]);

  const { fetchLockInfo } = useWalletPasswordInfo();
  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { fetchBiometrics } = useBiometrics();

  const formik = useFormik({
    initialValues: { currentPassword: '' },
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) return;

      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))(`Reseting password and keyrings`, {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      try {
        const [clearResult, _resetSuccess] = await Promise.all([
          apisLock.dangerouslyResetPasswordAndKeyrings(
            values.currentPassword,
            RABBY_MOBILE_KR_PWD,
          ),
          apisKeychain.resetGenericPassword(),
        ]);
        if (clearResult.error) {
          toast.show(clearResult.error);
        } else {
          toast.success('Reset Successfully');
          resetHasTipedUserEnableBiometrics();
          toggleShowSheetModal('resetPasswordAndKeyringModalRef', false);

          setTimeout(() => {
            redirectToAddAddressEntry({ action: 'resetTo' });
          }, 250);
        }
      } finally {
        Promise.allSettled([
          fetchLockInfo(),
          fetchAccounts(),
          fetchBiometrics(),
        ]);
        toastHide();
      }
    },
  });

  const shouldDisabled = !!getFormikErrorsCount(formik.errors);

  return { formik, shouldDisabled };
}
export const ResetPasswordAndKeyringsSheetModal = (props: Props) => {
  const { height = 422 } = props;
  const { formik, shouldDisabled } = useResetPasswordAndKeyringsForm();

  const { sheetModalRefs, toggleShowSheetModal } =
    useSheetModalsForManagingPassword();
  const insets = useSafeAreaInsets();

  const { colors, styles } = useThemeStyles(getStyles);
  const cancel = useCallback(() => {
    formik.resetForm();
    toggleShowSheetModal('resetPasswordAndKeyringModalRef', false);
  }, [formik, toggleShowSheetModal]);

  const passwordInputRef = React.useRef<TextInput>(null);

  // const { onTouchInputAway } = useInputBlurOnTouchaway([passwordInputRef]);

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      index={0}
      ref={sheetModalRefs.resetPasswordAndKeyringModalRef}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      snapPoints={[height + insets.bottom]}>
      <AutoLockView
        as="BottomSheetView"
        style={[styles.container, { paddingBottom: 20 + insets.bottom }]}>
        <Text style={styles.title}>{'⚠️ Clear Password and Keyrings'}</Text>
        <View style={styles.bodyContainer}>
          <View style={styles.descWrapper}>
            <Text style={[styles.desc]}>
              {'Will clear all keyrings and password, are you sure?'}
            </Text>
          </View>

          <View style={styles.formWrapper}>
            <View style={styles.inputHorizontalGroup}>
              <Text style={styles.formFieldLabel}>Current Password</Text>
              <FormInput
                as="BottomSheetTextInput"
                ref={passwordInputRef}
                style={styles.inputContainer}
                inputStyle={styles.input}
                inputProps={{
                  value: formik.values.currentPassword,
                  secureTextEntry: true,
                  inputMode: 'text',
                  returnKeyType: 'none',
                  placeholder: 'Confirm cancellation by entering your password',
                  placeholderTextColor: colors['neutral-foot'],
                  onChangeText(text) {
                    formik.setFieldValue('currentPassword', text);
                  },
                }}
                errorText={formik.errors.currentPassword}
              />
            </View>
          </View>
        </View>
        <View style={styles.btnGroup}>
          <View style={styles.border} />
          <Button
            onPress={cancel}
            title={'Cancel'}
            type="primary"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnConfirmTitle}
            containerStyle={[styles.btnContainer, styles.btnConfirmContainer]}>
            Cancel
          </Button>
          <View style={styles.btnGap} />
          <Button
            disabled={shouldDisabled}
            onPress={formik.handleSubmit}
            title={'Confirm'}
            type="clear"
            buttonStyle={[styles.buttonStyle]}
            titleStyle={styles.btnCancelTitle}
            containerStyle={[styles.btnContainer, styles.btnCancelContainer]}>
            Confirm
          </Button>
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  sheet: {
    backgroundColor: colors['neutral-bg-1'],
  },
  container: {
    flex: 1,
    paddingVertical: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: colors['neutral-title-1'],
    textAlign: 'center',
  },

  bodyContainer: {
    width: '100%',
    height: '100%',
    flexShrink: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 0,
    // ...makeDebugBorder('yellow'),
  },

  descWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  desc: {
    width: '100%',
    color: colors['neutral-body'],
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 16,
  },

  formWrapper: {
    flexShrink: 1,
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'column',
    // justifyContent: 'space-between',
    alignItems: 'center',
  },
  formFieldLabel: {
    fontSize: 14,
    fontWeight: '400',
    // backgroundColor: colors['neutral-card1'],
    backgroundColor: 'transparent',
    color: colors['neutral-title1'],
    marginBottom: 8,
  },
  inputHorizontalGroup: {
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    // ...makeDebugBorder(),
  },

  inputContainer: {
    borderRadius: 8,
    height: 56,
  },
  input: {
    backgroundColor: colors['neutral-card1'],
    fontSize: 14,
  },

  btnGroup: {
    paddingTop: 20,
    paddingHorizontal: 20,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto',
    position: 'relative',
  },

  border: {
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-bg1'],
    position: 'absolute',
    top: 0,
    left: 0,
  },

  btnContainer: {
    flexShrink: 1,
    display: 'flex',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    maxWidth: 170,
  },
  btnGap: {
    width: 18,
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
}));
