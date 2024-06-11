import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { useScanner } from '../Scanner/ScannerScreen';
import { useNavigation } from '@react-navigation/native';
import { RcIconInfo2CC } from '@/assets/icons/common';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    alert: {
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['red-default'],
      backgroundColor: colors['red-light'],
      gap: 6,
      borderRadius: 8,
      flexDirection: 'row',
    },
    alertText: {
      color: colors['red-default'],
      fontSize: 14,
    },
  });

export const BackupPrivateKeyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [privateKey, setPrivateKey] = React.useState<string>('');
  const [error, setError] = React.useState<string>();
  const scanner = useScanner();
  const nav = useNavigation();

  const handleDone = React.useCallback(() => {
    nav.goBack();
  }, [nav]);

  React.useEffect(() => {
    setError(undefined);
  }, [privateKey]);

  React.useEffect(() => {
    if (scanner.text) {
      setPrivateKey(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Done')}
      onPressButton={handleDone}>
      <View style={styles.alert}>
        <RcIconInfo2CC color={colors['red-default']} />
        <Text style={styles.alertText}>{t('page.backupPrivateKey.alert')}</Text>
      </View>
    </FooterButtonScreenContainer>
  );
};
