import { APP_TEST_PWD } from '@/constant';
import { keyringService } from '@/core/services';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { FooterButtonScreenContainer } from '../ScreenContainer/FooterButtonScreenContainer';
import { BackupIcon } from './BackupIcon';

const getStyles = createGetStyles(colors => ({
  title: {
    color: colors['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    marginTop: 28,
  },
  root: {
    alignItems: 'center',
  },
  description: {
    color: colors['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors['neutral-line'],
    backgroundColor: 'transparent',
    borderRadius: 8,
    width: '100%',
    color: colors['neutral-title-1'],
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 28,
  },
  container: {
    backgroundColor: colors['neutral-bg-1'],
    paddingTop: 24,
    height: 460,
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
  const { styles } = useThemeStyles(getStyles);
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
          paddingBottom: 50,
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
          <BottomSheetTextInput
            secureTextEntry
            value={password}
            onChangeText={v => {
              setPassword(v);
              setError('');
              onClearError?.();
            }}
            placeholderTextColor={colors['neutral-foot']}
            style={StyleSheet.flatten([
              styles.input,
              {
                borderColor: error
                  ? colors['red-default']
                  : colors['neutral-line'],
              },
            ])}
            placeholder={t(
              'page.newAddress.seedPhrase.backupUnlockPlaceholder',
            )}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};
