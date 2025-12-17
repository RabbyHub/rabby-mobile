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
import { apiMnemonic } from '@/core/apis';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { IS_IOS } from '@/core/native/utils';
import { useNavigation } from '@react-navigation/native';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    walletItem: {
      marginBottom: 16,
      borderRadius: 8,
      height: 64,
      gap: 4,
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
      marginBottom: 12,
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
  const nav = useNavigation();

  const handleBackupToCloud = React.useCallback(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD,
      bottomSheetModalProps: {
        enableDynamicSizing: true,
        maxDynamicContentSize: 460,
      },
      onDone: isNoMnemonic => {
        setTimeout(() => {
          removeGlobalBottomSheetModal(id);
        }, 0);
        if (isNoMnemonic) {
          nav.goBack();
        }
      },
    });
  }, [nav]);

  const handleBackupToPaper = React.useCallback(() => {
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.CreateMnemonic,
    });
  }, []);

  React.useEffect(() => {
    apiMnemonic.generatePreMnemonic();
  }, []);

  return (
    <NormalScreenContainer>
      <View style={styles.hero}>
        <SeedCreateSuccessSVG />
        <Text style={styles.heroTitle}>
          {t('page.newAddress.seedPhrase.createdSuccess')}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.bodyTitle}>
          {t('page.newAddress.seedPhrase.chooseBackupMethodTitle')}
        </Text>
        <Text style={styles.bodyDesc}>
          {t('page.newAddress.seedPhrase.chooseBackupMethodDesc')}
        </Text>
        <WalletItem
          style={styles.walletItem}
          Icon={IS_IOS ? ICloudIcon : GDriveIcon}
          title={
            IS_IOS
              ? t('page.newAddress.seedPhrase.icloudBackup')
              : t('page.newAddress.seedPhrase.googleDriveBackup')
          }
          onPress={handleBackupToCloud}
        />
        <WalletItem
          style={styles.walletItem}
          Icon={ManualIcon}
          title={t('page.newAddress.seedPhrase.manuallyBackup')}
          onPress={handleBackupToPaper}
        />
      </View>
    </NormalScreenContainer>
  );
};
