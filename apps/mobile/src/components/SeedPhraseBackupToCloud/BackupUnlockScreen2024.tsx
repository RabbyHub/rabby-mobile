import { APP_TEST_PWD } from '@/constant';
import { keyringService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { BackupIcon } from '@/components/SeedPhraseBackupToCloud2024/BackupIcon';
import { NextInput } from '@/components2024/Form/Input';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';

const getStyle = createGetStyles2024(colors => ({
  title: {
    color: colors.colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    marginTop: 25,
  },
  root: {
    alignItems: 'center',
  },
  description: {
    color: colors.colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 17,
  },
  input: {
    marginTop: 23,
  },
  container: {
    backgroundColor: colors.colors2024['neutral-bg-1'],
    paddingTop: 24,
    height: '100%',
    paddingHorizontal: 20,
    display: 'flex',
    justifyContent: 'space-between',
  },
  errorText: {
    color: colors['red-default'],
    marginTop: 12,
    fontSize: 14,
    minHeight: 20,
    marginBottom: 30,
  },
  inputWrapper: {
    width: '100%',
  },
  btns: {
    padding: 0,
    marginTop: 20,
    paddingBottom: 56,
  },
}));

interface Props {
  onConfirm: (password: string) => void;
  description?: string;
  title?: string;
  onCancel?: () => void;
  ignoreValidation?: boolean;
  isError?: boolean;
  onClearError?: () => void;
}

export const BackupUnlockScreen: React.FC<Props> = ({
  onConfirm,
  description,
  title,
  onCancel,
  ignoreValidation,
  isError,
  onClearError,
}) => {
  const [password, setPassword] = React.useState<string>(APP_TEST_PWD);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [error, setError] = React.useState<string>();
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    if (!password) {
      return;
    }
    if (password.length < 8) {
      setError(t('page.newAddress.seedPhrase.passwordMinTip'));
      return;
    }

    setLoading(true);
    try {
      if (!ignoreValidation) {
        await keyringService.verifyPassword(password);
      }
      onConfirm(password);
    } catch (e) {
      setError(t('page.unlock.password.error'));
    } finally {
      setLoading(false);
    }
  }, [ignoreValidation, onConfirm, password, t]);

  React.useEffect(() => {
    if (isError) {
      setError(t('page.unlock.password.error'));
    }
  }, [isError, t]);

  return (
    <View style={styles.container}>
      <View style={styles.root}>
        <BackupIcon status="unlock" isGray isDown={true} />
        <Text style={styles.title}>
          {title || t('page.newAddress.seedPhrase.backupUnlockTitle')}
        </Text>
        <Text style={styles.description}>
          {description || t('page.newAddress.seedPhrase.backupUnlockDesc')}
        </Text>
        <View style={styles.inputWrapper}>
          <NextInput.Password
            // initialPasswordVisible
            as={'BottomSheetTextInput'}
            fieldName="Enter the Password to Confirm"
            containerStyle={Object.assign(
              {},
              error
                ? {}
                : {
                    borderColor: 'transparent',
                  },
            )}
            inputProps={{
              value: password,
              secureTextEntry: true,
              inputMode: 'text',
              returnKeyType: 'done',
              placeholderTextColor: colors2024['neutral-foot'],
              onChangeText: v => {
                setPassword(v);
                setError('');
                onClearError?.();
              },
            }}
            style={styles.input}
            hasError={Boolean(error)}
            fieldErrorContainerStyle={{ paddingLeft: 4, marginTop: 8 }}
            tipText={error || t('page.newAddress.seedPhrase.passwordMinTip')}
          />
        </View>
      </View>
      <FooterButtonGroup
        style={styles.btns}
        onCancel={onCancel}
        disable={!password}
        loading={loading}
        onConfirm={handleConfirm}
      />
    </View>
  );
};
