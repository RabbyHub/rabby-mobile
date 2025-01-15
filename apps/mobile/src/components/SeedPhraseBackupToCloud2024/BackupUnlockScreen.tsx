/* eslint-disable react-native/no-inline-styles */
import { APP_TEST_PWD } from '@/constant';
import { keyringService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BackupIcon } from './BackupIcon';
import { Button } from '@/components2024/Button';
import { NextInput } from '@/components2024/Form/Input';
import { useCreateAddressProc } from '@/hooks/address/useNewUser';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  title: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    marginTop: 25,
  },
  root: {
    alignItems: 'center',
  },
  description: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    // lineHeight: 22,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '400',
  },
  input: {
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: 'transparent',
    borderRadius: 8,
    width: '100%',
    color: colors2024['neutral-title-1'],
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 28,
  },
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingTop: 24,
    paddingHorizontal: 20,
    height: '100%',
    display: 'flex',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    width: '100%',
    marginTop: 23,
  },
  btnContainer: {
    width: '100%',
    marginTop: 20,
    paddingBottom: 56,
  },
  inputStyle: {
    borderWidth: 0,
  },
}));

interface Props {
  onConfirm: (password: string) => void;
  ignoreValidation?: boolean;
}

export const BackupUnlockScreen: React.FC<Props> = ({
  onConfirm,
  ignoreValidation,
}) => {
  const [password, setPassword] = React.useState<string>(APP_TEST_PWD);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [error, setError] = React.useState<string>();
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const { isCorrectPassword } = useCreateAddressProc();

  const handleConfirm = React.useCallback(async () => {
    if (!password) {
      return;
    }

    setLoading(true);
    try {
      if (!ignoreValidation && !isCorrectPassword(password)) {
        await keyringService.verifyPassword(password);
      }
      await onConfirm(password);
    } catch (e) {
      setError(t('page.unlock.password.error'));
    } finally {
      setLoading(false);
    }
  }, [ignoreValidation, isCorrectPassword, onConfirm, password, t]);

  return (
    <View style={styles.container}>
      <View style={styles.root}>
        <BackupIcon status={loading ? 'uploading' : 'unlock'} isGray />
        <Text style={styles.title}>
          {t('page.newAddress.seedPhrase.backupUnlockTitle')}
        </Text>
        <Text style={styles.description}>
          {t('page.newAddress.seedPhrase.backupUnlockDesc')}
        </Text>
        <View style={styles.inputWrapper}>
          <NextInput.Password
            // initialPasswordVisible
            as={'BottomSheetTextInput'}
            containerStyle={styles.inputStyle}
            fieldName="Enter the Password to Confirm"
            inputProps={{
              value: password,
              secureTextEntry: true,
              inputMode: 'text',
              returnKeyType: 'done',
              placeholderTextColor: colors2024['neutral-foot'],
              onChangeText: v => {
                setPassword(v);
                setError('');
              },
            }}
            hasError={Boolean(error)}
            fieldErrorContainerStyle={{ paddingLeft: 4, marginTop: 8 }}
            tipText={error || t('page.createPassword.passwordMinTip')}
          />
        </View>
      </View>
      <Button
        disabled={!password}
        containerStyle={styles.btnContainer}
        buttonStyle={{
          borderRadius: 100,
        }}
        type="primary"
        loading={loading}
        title={t('page.nextComponent.createNewAddress.Confirm')}
        onPress={handleConfirm}
      />
    </View>
  );
};
