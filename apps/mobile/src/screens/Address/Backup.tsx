import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { IS_IOS } from '@/core/native/utils';
import { Text } from '@/components/Typography';
import { useRoute, useNavigation } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';

import RcIconBackupCloud from '@/assets2024/icons/backup/cloud.svg';
import RcIconBackupManual from '@/assets2024/icons/backup/manual.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { apiMnemonic } from '@/core/apis';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { clearAccountBackupReminder } from '@/hooks/account';
import { AddressNavigatorParamList } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { checkCloudBackupExists } from '@/core/utils/cloudBackup';
import { useBiometricsComputed } from '@/hooks/biometrics';

type BackupScreenRouteProp = RouteProp<
  AddressNavigatorParamList,
  typeof RootNames.Backup
>;

function Backup(): JSX.Element {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const route = useRoute<BackupScreenRouteProp>();
  const navigation = useNavigation();
  const bioComputed = useBiometricsComputed();

  const { address, type, brandName } = route.params || {};
  const invokeEnterPassphrase = useEnterPassphraseModal('address');

  const [hasCloudBackup, setHasCloudBackup] = React.useState(false);

  React.useEffect(() => {
    if (!address) return;

    const checkCloudBackup = async () => {
      try {
        const exists = await checkCloudBackupExists(address);
        setHasCloudBackup(exists);
      } catch (error) {
        console.error('Failed to check cloud backup status:', error);
      }
    };

    checkCloudBackup();
  }, [address]);

  const handleBackupComplete = React.useCallback(() => {
    if (address && type && brandName) {
      clearAccountBackupReminder({
        address,
        type: type as KEYRING_TYPE,
        brandName,
      });
    }
    navigation.goBack();
  }, [address, type, brandName, navigation]);

  // Get auth modal labels based on expected auth type
  const getAuthModalLabels = React.useCallback(() => {
    if (bioComputed.isBiometricsEnabled) {
      if (bioComputed.isFaceID) {
        return {
          title: t('page.addressDetail.verify-face-id'),
          description: t('page.addressDetail.verify-face-id-before-backup'),
        };
      }
      return {
        title: t('page.addressDetail.verify-fingerprint'),
        description: t('page.addressDetail.verify-fingerprint-before-backup'),
      };
    }
    return {
      title: t('page.addressDetail.verify-password'),
      description: t('page.addressDetail.verify-password-before-backup'),
    };
  }, [bioComputed.isBiometricsEnabled, bioComputed.isFaceID, t]);

  const handleBackupToCloud = React.useCallback(() => {
    // For cloud backup from AddressDetail, we need to authenticate first to get
    // the seed phrase, then pass it to the cloud backup modal.
    let seedPhraseData = '';
    const { title, description } = getAuthModalLabels();

    AuthenticationModal2024.show({
      confirmText: t('page.addressDetail.verify-and-backup'),
      title,
      description,
      hideCancelButton: true,
      validationHandler: async (password: string) => {
        if (!address) return;
        seedPhraseData = await apiMnemonic.getMnemonics(password, address);

        if (type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(address);
        }
      },
      onFinished(ctx) {
        if (ctx.hasSetupCustomPassword && !seedPhraseData) {
          return;
        }

        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD,
          bottomSheetModalProps: {
            enableContentPanningGesture: true,
            enablePanDownToClose: true,
          },
          // Pass seed phrase for existing user backup flow
          seedPhraseData,
          skipKeyringCreation: true,
          onDone: () => {
            removeGlobalBottomSheetModal2024(id);
            handleBackupComplete();
          },
        });
      },
    });
  }, [
    address,
    type,
    t,
    invokeEnterPassphrase,
    handleBackupComplete,
    getAuthModalLabels,
  ]);

  const handleBackupToPaper = React.useCallback(() => {
    let seedPhraseData = '';
    const { title, description } = getAuthModalLabels();

    AuthenticationModal2024.show({
      confirmText: t('page.addressDetail.verify-and-backup'),
      title,
      description,
      hideCancelButton: true,
      validationHandler: async (password: string) => {
        if (!address) return;
        seedPhraseData = await apiMnemonic.getMnemonics(password, address);

        if (type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(address);
        }
      },
      onFinished(ctx) {
        if (ctx.hasSetupCustomPassword && !seedPhraseData) {
          return;
        }

        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP,
          bottomSheetModalProps: {
            enableContentPanningGesture: false,
            enablePanDownToClose: true,
          },
          preventScreenshotOnModalOpen: false,
          readMode: true,
          seedPhraseData,
          onDone: () => {
            removeGlobalBottomSheetModal2024(id);
            handleBackupComplete();
          },
        });
      },
    });
  }, [
    address,
    type,
    t,
    invokeEnterPassphrase,
    handleBackupComplete,
    getAuthModalLabels,
  ]);

  return (
    <NormalScreenContainer
      overwriteStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
      }}>
      <View style={styles.container}>
        {/* Cloud Backup Card */}
        <Pressable
          style={styles.card}
          onPress={handleBackupToCloud}
          android_ripple={{ color: colors2024['neutral-line'] }}>
          <View style={styles.cardContent}>
            <View style={styles.iconRow}>
              <RcIconBackupCloud width={40} height={40} />
              <Text style={styles.cardTitle}>
                {IS_IOS
                  ? t('page.newAddress.seedPhrase.icloudBackup')
                  : t('page.newAddress.seedPhrase.googleDriveBackup')}
              </Text>
            </View>
            {hasCloudBackup ? (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>
                  {t('page.newAddress.Done')}
                </Text>
              </View>
            ) : (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>
                  {t('page.newAddress.Quick')}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Manual Backup Card */}
        <Pressable
          style={styles.card}
          onPress={handleBackupToPaper}
          android_ripple={{ color: colors2024['neutral-line'] }}>
          <View style={styles.cardContent}>
            <View style={styles.iconRow}>
              <RcIconBackupManual width={40} height={40} />
              <Text style={styles.cardTitle}>
                {t('page.newAddress.seedPhrase.manuallyBackup')}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    marginBottom: 12,
    padding: 20,
    shadowColor: colors2024['neutral-title-1'],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  quickBadge: {
    backgroundColor: colors2024['brand-light-1'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  doneBadge: {
    backgroundColor: colors2024['green-light-1'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  doneBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['green-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

export default Backup;
