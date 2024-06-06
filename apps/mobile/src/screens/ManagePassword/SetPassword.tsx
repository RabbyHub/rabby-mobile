import { Trans, useTranslation } from 'react-i18next';

import React from 'react';
import { View, Text, TextInput } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { Button } from '@/components';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { FormInput } from '@/components/Form/Input';

import { default as RcPasswordLockCC } from './icons/password-lock-cc.svg';
import { CheckBoxCircled } from '@/components/Icons/Checkbox';

const LAYOUTS = {
  footerButtonHeight: 52,
  fixedFooterPaddingHorizontal: 20,
  fixedFooterPaddingVertical: 20,
  get fixedFooterHeight() {
    return this.footerButtonHeight + this.fixedFooterPaddingVertical * 2;
  },
};

export default function SetPasswordScreen() {
  const { styles, colors } = useThemeStyles(getStyles);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: LAYOUTS.fixedFooterHeight,
    footerHeight: LAYOUTS.fixedFooterHeight,
    nextButtonContainerHeight: LAYOUTS.footerButtonHeight,
  });

  const passwordInputRef = React.useRef<TextInput>(null);
  const confirmPasswordInputRef = React.useRef<TextInput>(null);

  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: safeSizes.containerPaddingBottom },
      ]}>
      <View style={styles.topContainer}>
        <RcPasswordLockCC color={colors['neutral-title2']} />
        <Text style={styles.title1}>{t('page.createPassword.title')}</Text>
        <Text style={styles.title2}>{t('page.createPassword.subTitle')}</Text>
      </View>
      <View style={styles.bodyContainer}>
        <View style={styles.formWrapper}>
          <View style={styles.inputHorizontalGroup}>
            <FormInput
              ref={passwordInputRef}
              style={styles.inputContainer}
              inputStyle={styles.input}
              inputProps={{
                // value: '',
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: t('page.createPassword.passwordPlaceholder'),
                placeholderTextColor: colors['neutral-foot'],
              }}
            />

            <FormInput
              ref={confirmPasswordInputRef}
              style={[styles.inputContainer, { marginTop: 20 }]}
              inputStyle={styles.input}
              inputProps={{
                // value: '',
                secureTextEntry: true,
                inputMode: 'text',
                returnKeyType: 'done',
                placeholder: t(
                  'page.createPassword.confirmPasswordPlaceholder',
                ),
                placeholderTextColor: colors['neutral-foot'],
              }}
            />
          </View>
          <View style={styles.agreementWrapper}>
            <View>
              <CheckBoxCircled />
            </View>

            <Text style={styles.agreementText}>
              <Trans i18nKey="page.createPassword.agree" t={t}>
                I have read and agree to the{' '}
                <Text style={styles.termOfUse}>Term of Use</Text>
              </Trans>
            </Text>
          </View>
        </View>
      </View>
      <View
        style={[
          styles.fixedFooterContainer,
          { height: safeSizes.footerHeight },
        ]}>
        <Button
          disabled
          type="primary"
          containerStyle={[
            styles.nextButtonContainer,
            { height: safeSizes.nextButtonContainerHeight },
          ]}
          title={'Next'}
        />
      </View>
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      height: '100%',
      backgroundColor: colors['neutral-bg2'],
      paddingBottom: LAYOUTS.fixedFooterHeight,
    },
    topContainer: {
      backgroundColor: colors['blue-default'],
      height: 320,
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      flexShrink: 0,
    },
    title1: {
      color: colors['neutral-title2'],
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
    },
    title2: {
      color: colors['neutral-title2'],
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 8,
    },
    bodyContainer: {
      // backgroundColor: colors['neutral-bg2'],
      flexShrink: 1,
      height: '100%',
      paddingHorizontal: 0,
      paddingTop: 32,
      paddingBottom: 24,
      // ...makeDebugBorder()
    },
    formWrapper: {
      width: '100%',
      height: '100%',
      paddingHorizontal: 20,
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inputHorizontalGroup: {
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
    },

    inputContainer: {
      borderRadius: 8,
      height: 56,
    },
    input: {
      backgroundColor: colors['neutral-card1'],
      fontSize: 14,
    },

    agreementWrapper: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    agreementText: {
      marginLeft: 6,
      color: colors['neutral-body'],
    },
    termOfUse: {
      color: colors['blue-default'],
    },

    fixedFooterContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors['neutral-bg2'],
      height: LAYOUTS.fixedFooterHeight,
      paddingVertical: LAYOUTS.fixedFooterPaddingVertical,
      paddingHorizontal: LAYOUTS.fixedFooterPaddingHorizontal,
      borderTopWidth: 1,
      borderTopColor: colors['neutral-line'],
    },
    nextButtonContainer: {
      width: '100%',
      height: LAYOUTS.footerButtonHeight,
    },
  };
});
