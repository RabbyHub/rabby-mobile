import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { default as SeedCreateSuccessSVG } from '@/assets/icons/address/seed-create-success.svg';
import { ICloudIcon } from '@/assets/icons/address/icloud-icon';
import { GDriveIcon } from '@/assets/icons/address/gdrive-icon';
import { ManualIcon } from '@/assets/icons/address/manual-icon';
import { WalletItem } from './components/WalletItem';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    walletItem: {
      marginBottom: 16,
      borderRadius: 8,
    },
    hero: {
      alignItems: 'center',
      marginBottom: 66,
      gap: 12,
    },
    heroTitle: {
      color: colors['green-default'],
      fontSize: 18,
      fontWeight: '500',
      lineHeight: 21,
    },
    body: {
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    bodyTitle: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      marginBottom: 20,
    },
    bodyDesc: {
      color: colors['neutral-foot'],
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
      marginBottom: 32,
    },
  });

export const PreCreateSeedPhraseScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const handleBackupToCloud = React.useCallback(() => {
    console.log('handleBackup');
  }, []);

  const handleBackupToPaper = React.useCallback(() => {}, []);

  return (
    <NormalScreenContainer>
      <View style={styles.hero}>
        <SeedCreateSuccessSVG />
        <Text style={styles.heroTitle}>助记词创建成功</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.bodyTitle}>选择备份方式</Text>
        <Text style={styles.bodyDesc}>
          If you delete the APP or change your device, you can recover your Seed
          Phrase in the following ways
        </Text>
        <WalletItem
          style={styles.walletItem}
          Icon={ICloudIcon}
          title="通过 iCloud 备份"
          onPress={handleBackupToCloud}
        />
        <WalletItem
          style={styles.walletItem}
          Icon={ManualIcon}
          title="通过手动抄写备份"
          onPress={handleBackupToPaper}
        />
      </View>
    </NormalScreenContainer>
  );
};
