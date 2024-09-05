import { APP_TEST_PWD } from '@/constant';
import { keyringService } from '@/core/services';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React from 'react';
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
}

export const BackupUnlockScreen: React.FC<Props> = ({ onConfirm }) => {
  const [password, setPassword] = React.useState<string>(APP_TEST_PWD);
  const colors = useThemeColors();
  const { styles } = useThemeStyles(getStyles);
  const [error, setError] = React.useState<string>();

  const handleConfirm = React.useCallback(() => {
    if (!password) {
      return;
    }

    keyringService
      .verifyPassword(password)
      .then(() => {
        onConfirm(password);
      })
      .catch(e => {
        setError(e.message);
      });
  }, [onConfirm, password]);

  return (
    <FooterButtonScreenContainer
      style={styles.container}
      btnProps={{
        disabled: !password,
        footerStyle: {
          paddingBottom: 50,
        },
      }}
      buttonText={'开始备份'}
      onPressButton={handleConfirm}>
      <View style={styles.root}>
        <BackupIcon status="unlock" isGray />
        <Text style={styles.title}>Encrypt with Unlock Password</Text>
        <Text style={styles.description}>
          请保管好你的密码，后续恢复助记词的时需要验证该密码，并且Rabby没有存储也无法帮你找回
        </Text>
        <View style={styles.inputWrapper}>
          <BottomSheetTextInput
            secureTextEntry
            value={password}
            onChangeText={v => {
              setPassword(v);
              setError('');
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
            placeholder="Enter the Password to Confirm"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};
