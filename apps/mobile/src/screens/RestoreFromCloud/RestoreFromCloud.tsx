import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { BackupIcon } from '@/components/SeedPhraseBackupToCloud/BackupIcon';
import {
  BackupData,
  detectCloudIsAvailable,
  getBackupsFromCloud,
} from '@/core/utils/cloudBackup';
import { useThemeStyles } from '@/hooks/theme';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { createGetStyles } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { BackupItem } from './BackupItem';

const { isSameAddress } = addressUtils;

const getStyles = createGetStyles(colors => ({
  loading: {
    alignItems: 'center',
    marginTop: -200,
  },
  loadingText: {
    marginTop: 32,
    color: colors['neutral-foot'],
    fontSize: 16,
  },
  root: {},
  rootLoading: {
    justifyContent: 'center',
  },
  title: {
    color: colors['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    marginTop: 24,
    textAlign: 'center',
  },
  body: {
    marginTop: 30,
  },
  backupItem: {
    marginBottom: 16,
  },
  backupList: {
    marginTop: 20,
  },
}));

/** @deprecated */
export const RestoreFromCloud = () => {
  const [backups, setBackups] = React.useState<BackupData[]>();
  const [loading, setLoading] = React.useState(true);
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const [selectedFilenames, setSelectedFilenames] = React.useState<string[]>(
    [],
  );
  const [importedFiles, setImportedFiles] = React.useState<string[]>([]);
  const { seedPhraseList } = useSeedPhrase();
  const navigation = useNavigation();

  React.useEffect(() => {
    getBackupsFromCloud()
      .then(result => {
        setBackups(result);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleRestore = React.useCallback(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD,
      bottomSheetModalProps: {
        enableDynamicSizing: true,
        maxDynamicContentSize: 460,
      },
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal(id);
        }, 0);
      },
      files: backups?.filter(item => selectedFilenames.includes(item.filename)),
    });
  }, [backups, selectedFilenames]);

  const handleSelect = React.useCallback((filename: string) => {
    setSelectedFilenames(prev => {
      if (prev.includes(filename)) {
        return prev.filter(i => i !== filename);
      }
      return [...prev, filename];
    });
  }, []);

  React.useEffect(() => {
    detectCloudIsAvailable().then(result => {
      if (!result) {
        const id = createGlobalBottomSheetModal({
          name: MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE,
          onConfirm: () => {
            removeGlobalBottomSheetModal(id);
            navigation.goBack();
          },
        });
      }
    });
  }, [navigation]);

  React.useEffect(() => {
    if (backups?.length && seedPhraseList.length) {
      seedPhraseList.forEach(seedPhrase => {
        seedPhrase.list.forEach(account => {
          const found = backups.find(backup =>
            isSameAddress(backup.address, account.address),
          );
          if (found) {
            setImportedFiles(prev => [...prev, found.filename]);
          }
        });
      });
    }
  }, [backups, seedPhraseList]);

  React.useEffect(() => {
    if (backups) {
      setSelectedFilenames(
        backups
          .filter(b => !importedFiles.includes(b.filename))
          .map(item => item.filename),
      );
    }
  }, [backups, importedFiles]);

  if (loading) {
    return (
      <NormalScreenContainer
        style={StyleSheet.flatten([loading && styles.rootLoading])}>
        <View style={styles.loading}>
          <BackupIcon status="loading" />
          <Text style={styles.loadingText}>
            {t('page.newAddress.seedPhrase.backupRestoreLoadingText')}
          </Text>
        </View>
      </NormalScreenContainer>
    );
  }

  if (!backups?.length) {
    return (
      <NormalScreenContainer style={StyleSheet.flatten([styles.rootLoading])}>
        <View style={styles.loading}>
          <BackupIcon status="info" />
          <Text style={styles.loadingText}>
            {t('page.newAddress.seedPhrase.backupRestoreEmpty')}
          </Text>
        </View>
      </NormalScreenContainer>
    );
  }

  const len = selectedFilenames.length;

  return (
    <FooterButtonScreenContainer
      onPressButton={handleRestore}
      btnProps={{
        disabled: !len,
      }}
      buttonText={`${t('page.newAddress.seedPhrase.backupRestoreButton')} ${
        len ? `(${len})` : ''
      }`}>
      <View style={styles.body}>
        <View>
          <BackupIcon status="success" />
          <Text style={styles.title}>
            {t('page.newAddress.seedPhrase.backupRestoreTitle', {
              count: backups.length,
            })}
          </Text>
        </View>
        <View style={styles.backupList}>
          {backups.map((item, index) => {
            const imported = importedFiles.includes(item.filename);
            const selected = selectedFilenames.includes(item.filename);
            return (
              <BackupItem
                key={index}
                item={item}
                selected={selected}
                imported={imported}
                onPress={() => handleSelect(item.filename)}
                index={index}
                style={styles.backupItem}
              />
            );
          })}
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};
