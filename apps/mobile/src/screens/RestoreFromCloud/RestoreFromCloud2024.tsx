import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { BackupIcon } from '@/components/SeedPhraseBackupToCloud2024/BackupIcon';
import {
  BackupData,
  detectCloudIsAvailable,
  getBackupsFromCloud,
} from '@/core/utils/cloudBackup';
import { useTheme2024 } from '@/hooks/theme';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { createGetStyles2024 } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { BackupItem, BackupItemSkeleton } from './BackupItem';
import { Button } from '@/components2024/Button';
import { IS_IOS } from '@/core/native/utils';

const { isSameAddress } = addressUtils;

export const RestoreFromCloud2024: React.FC<{
  onDone: () => void;
}> = ({ onDone }) => {
  const [backups, setBackups] = React.useState<BackupData[]>();
  const [loading, setLoading] = React.useState(true);
  const { styles } = useTheme2024({ getStyle });

  const { t } = useTranslation();
  const [selectedFilenames, setSelectedFilenames] = React.useState<string[]>(
    [],
  );
  const [importedFiles, setImportedFiles] = React.useState<string[]>([]);
  const { seedPhraseList } = useSeedPhrase();

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
          },
        });
      }
    });
  }, []);

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

  if (!backups?.length) {
    return (
      <NormalScreenContainer
        noHeader
        overwriteStyle={styles.loadingContainer}
        style={StyleSheet.flatten([styles.rootLoading])}>
        <View style={styles.empty}>
          <BackupIcon status="info" />
          <Text style={styles.restoreTitle}>
            {`Restore From ${IS_IOS ? 'ICloud' : 'Google Drive'}`}
          </Text>
          <Text style={styles.loadingText}>
            {t('page.newAddress.seedPhrase.backupRestoreEmpty')}
          </Text>
        </View>
        <Button
          containerStyle={styles.btnContainer}
          type="primary"
          title="Back"
          onPress={onDone}
        />
      </NormalScreenContainer>
    );
  }

  const len = selectedFilenames.length;

  return (
    <FooterButtonScreenContainer
      onPressButton={handleRestore}
      btnProps={{
        disabled: !len || loading,
      }}
      style={styles.screenContainer}
      buttonText={`${t('page.newAddress.seedPhrase.backupRestoreButton')} ${
        len ? `(${len})` : ''
      }`}>
      <View style={styles.body}>
        <View>
          <BackupIcon status="success" />
          <Text style={styles.restoreTitle}>
            {`Restore Fromm ${IS_IOS ? 'ICloud' : 'Google Drive'}`}
          </Text>
        </View>
        <View style={styles.backupList}>
          {loading ? (
            <>
              <BackupItemSkeleton />
              <BackupItemSkeleton />
            </>
          ) : (
            backups.map((item, index) => {
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
            })
          )}
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};

const getStyle = createGetStyles2024(colors => ({
  loading: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  empty: {
    alignItems: 'center',
    marginTop: 20,
  },
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 24,
  },
  restoreTitle: {
    marginTop: 25,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.colors2024['neutral-title-1'],
  },
  loadingText: {
    marginTop: 14,
    color: colors.colors2024['neutral-secondary'],
    fontSize: 17,
    lineHeight: 22,
  },
  root: {},
  rootLoading: {
    // justifyContent: 'center',
  },
  title: {
    color: colors['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    marginTop: 24,
    textAlign: 'center',
  },
  screenContainer: {
    paddingTop: 0,
  },
  body: {
    marginTop: 20,
  },
  backupItem: {
    marginBottom: 16,
  },
  backupList: {
    marginTop: 32,
  },
  loadingList: {
    marginTop: 32,
    paddingHorizontal: 25,
  },
}));
