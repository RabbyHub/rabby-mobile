import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { RcIconInfo2CC } from '@/assets/icons/common';
import { RootNames } from '@/constant/layout';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { MaskContainer } from './components/MaskContainer';

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
      flex: 1,
    },
    seedPhraseContainer: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      padding: 12,
      height: 100,
      position: 'relative',
      overflow: 'hidden',
    },
    main: {
      gap: 40,
      flex: 1,
      alignItems: 'center',
    },
    seedPhraseContainerText: {
      color: colors['neutral-title1'],
      fontSize: 15,
      lineHeight: 20,
    },
    copyButton: {
      position: 'absolute',
      right: 6,
      bottom: 6,
    },
  });

export const BackSeedPhraseScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const nav = useNavigation();
  const { data } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.BackupMnemonic)?.params,
  ) as {
    data: string;
  };

  const handleDone = React.useCallback(() => {
    nav.goBack();
  }, [nav]);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Done')}
      onPressButton={handleDone}>
      <View style={styles.main}>
        <View style={styles.alert}>
          <RcIconInfo2CC color={colors['red-default']} />
          <Text style={styles.alertText}>
            {t('page.backupSeedPhrase.alert')}
          </Text>
        </View>

        <View style={styles.seedPhraseContainer}>
          <MaskContainer
            isLight
            text={t('page.backupSeedPhrase.clickToShow')}
          />
          <Text style={styles.seedPhraseContainerText}>{data}</Text>
          <CopyAddressIcon style={styles.copyButton} address={data} />
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};
