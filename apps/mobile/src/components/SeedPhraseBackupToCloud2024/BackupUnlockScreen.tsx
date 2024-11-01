import { APP_TEST_PWD } from '@/constant';
import { keyringService } from '@/core/services';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { FooterButtonScreenContainer } from '../ScreenContainer/FooterButtonScreenContainer';
import { BackupIcon } from './BackupIcon';
import { NextInput } from '@/components2024/Form/Input';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  title: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    marginTop: 28,
  },
  root: {
    alignItems: 'center',
  },
  description: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
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
    height: 460,
  },
  inputWrapper: {
    width: '100%',
    marginTop: 22,
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
  const colors = useThemeColors();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [error, setError] = React.useState<string>();
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    if (!password) {
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
    <FooterButtonScreenContainer
      onCancel={onCancel}
      style={styles.container}
      btnProps={{
        disabled: !password,
        footerStyle: {
          paddingBottom: 60,
        },
        loading,
      }}
      buttonText={t('page.newAddress.seedPhrase.backupUnlockButton')}
      onPressButton={handleConfirm}>
      <View style={styles.root}>
        <BackupIcon status="unlock" isGray />
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
            fieldName="New password"
            inputProps={{
              value: password,
              secureTextEntry: true,
              inputMode: 'text',
              placeholder: t('page.createPassword.passwordPlaceholder'),
              placeholderTextColor: colors2024['neutral-foot'],
              onChangeText: v => {
                setPassword(v);
                setError('');
                onClearError?.();
              },
            }}
          />
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};
