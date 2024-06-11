import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import * as Yup from 'yup';

import { default as RcRabbyLogo } from './icons/rabby-logo.svg';
import { Button } from '@/components';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { FormInput } from '@/components/Form/Input';
import { useTranslation } from 'react-i18next';
import { useInputBlurOnTouchaway } from '@/components/Form/hooks';
import { SilentTouchableView } from '@/components/Touchable/TouchableView';
import { useFormik } from 'formik';
import { toast, toastWithIcon } from '@/components/Toast';
import { apisLock } from '@/core/apis';
import {
  resetNavigationToHome,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { getFormikErrorsCount } from '@/utils/patch';

const LAYOUTS = {
  footerButtonHeight: 52,
  containerPadding: 20,
};

const STOP_REDIRECT_TO_HOME_ON_UNLOCKED_ON_DEV = false;

function useUnlockForm(navigation: ReturnType<typeof useRabbyAppNavigation>) {
  const { t } = useTranslation();
  const yupSchema = React.useMemo(() => {
    return Yup.object({
      password: Yup.string().required(t('page.unlock.password.required')),
    });
  }, [t]);

  const formik = useFormik({
    initialValues: { password: '' },
    validationSchema: yupSchema,
    validateOnMount: false,
    validateOnBlur: true,
    onSubmit: async (values, helpers) => {
      let errors = await helpers.validateForm();

      if (getFormikErrorsCount(errors)) return;

      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={{ marginRight: 6 }} />
      ))(`Unlocking`, {
        duration: 1e6,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });

      try {
        const result = await apisLock.unlockWallet(values.password);
        if (result.error) {
          helpers.setFieldError('password', t('page.unlock.password.error'));
          toast.show(result.error);
        } else {
          resetNavigationToHome(navigation);
        }
      } finally {
        toastHide();
      }
    },
  });

  const shouldDisabled = !formik.values.password;

  return { formik, shouldDisabled };
}

export default function UnlockScreen() {
  const { styles, colors } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const navigation = useRabbyAppNavigation();
  const { formik, shouldDisabled } = useUnlockForm(navigation);
  const { setFieldValue, errors, handleSubmit } = formik;

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: 0,
    footerHeight: LAYOUTS.footerButtonHeight,
    nextButtonContainerHeight: LAYOUTS.footerButtonHeight,
  });

  const passwordInputRef = React.useRef<TextInput>(null);
  const { onTouchInputAway } = useInputBlurOnTouchaway(passwordInputRef);

  useEffect(() => {
    if (__DEV__ && STOP_REDIRECT_TO_HOME_ON_UNLOCKED_ON_DEV) {
      console.debug('UnlockScreen::useEffect skipped on DEV mode.');
      return;
    }

    if (!apisLock.isUnlocked()) return;

    resetNavigationToHome(navigation);
  }, [navigation]);

  return (
    <SilentTouchableView
      style={{ height: '100%', flex: 1 }}
      viewProps={{
        style: [
          styles.container,
          { paddingBottom: safeSizes.containerPaddingBottom },
        ],
      }}
      onPress={onTouchInputAway}>
      <View style={styles.topContainer}>
        <RcRabbyLogo style={{ width: 100, height: 100 }} />
        <Text style={styles.title1}>Rabby Wallet</Text>
      </View>
      <View style={styles.bodyContainer}>
        <View style={styles.formWrapper}>
          <FormInput
            ref={passwordInputRef}
            style={styles.inputContainer}
            inputStyle={styles.input}
            errorText={errors.password}
            inputProps={{
              // value: '',
              secureTextEntry: true,
              inputMode: 'text',
              returnKeyType: 'done',
              placeholder: t('page.unlock.password.placeholder'),
              placeholderTextColor: colors['neutral-foot'],
              onChangeText(text) {
                // const nextErrors = { ...formik.errors };
                // delete nextErrors.password;
                // formik.setErrors(nextErrors);
                formik.setFieldError('password', undefined);
                setFieldValue('password', text);
              },
            }}
          />
        </View>
        <View
          style={[
            styles.unlockButtonWrapper,
            { height: safeSizes.footerHeight },
          ]}>
          <Button
            disabled={shouldDisabled}
            type="primary"
            buttonStyle={[styles.buttonShadow]}
            containerStyle={[
              styles.nextButtonContainer,
              { height: safeSizes.nextButtonContainerHeight },
            ]}
            title={'Next'}
            onPress={evt => {
              evt.stopPropagation();
              handleSubmit();
            }}
          />
        </View>
      </View>
    </SilentTouchableView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      height: '100%',
      backgroundColor: colors['neutral-bg1'],
      justifyContent: 'center',
    },
    topContainer: {
      backgroundColor: 'transparent',
      paddingBottom: 100,
      width: '100%',
      height:
        150 /* min paddingTop */ + 100 /* height */ + 100 /* paddingBottom */,
      // height: '100%',
      flexShrink: 0,
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: 0,
    },
    title1: {
      color: colors['blue-default'],
      fontSize: 24,
      fontWeight: '700',
      marginTop: 13,
    },
    bodyContainer: {
      flexShrink: 0,
      height: '50%',
      paddingHorizontal: 0,
      paddingTop: 32,
      paddingBottom: 24,
      backgroundColor: colors['neutral-bg1'],
      // ...makeDebugBorder()
    },
    formWrapper: {
      width: '100%',
      paddingHorizontal: LAYOUTS.containerPadding,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    inputContainer: {
      borderRadius: 8,
      height: 64,
    },
    input: {
      backgroundColor: colors['neutral-card1'],
      height: '100%',
      fontSize: 14,
    },
    formFieldError: {
      marginTop: 12,
    },
    formFieldErrorText: {
      color: colors['red-default'],
      fontSize: 14,
      fontWeight: '400',
      textAlign: 'center',
    },

    unlockButtonWrapper: {
      marginTop: 60,
      height: LAYOUTS.footerButtonHeight,
      paddingHorizontal: LAYOUTS.containerPadding,
    },
    nextButtonContainer: {
      width: '100%',
      height: LAYOUTS.footerButtonHeight,
    },
    buttonShadow: {
      // boxShadow: '0px 4px 16px 0px rgba(112, 132, 255, 0.30)',
      shadowColor: 'rgba(112, 132, 255, 0.30)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
    },
  };
});
