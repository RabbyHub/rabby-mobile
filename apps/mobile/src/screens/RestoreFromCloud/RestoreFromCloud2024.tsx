import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { BackupIcon } from '@/components/SeedPhraseBackupToCloud2024/BackupIcon';
import {
  BackupData,
  detectCloudIsAvailable,
  getBackupsFromCloud,
} from '@/core/utils/cloudBackup';
import { useTheme2024 } from '@/hooks/theme';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BackupItem, BackupItemSkeleton } from './BackupItem2024';
import { Button } from '@/components2024/Button';
import { BottomSheetView } from '@gorhom/bottom-sheet';

import { IS_IOS } from '@/core/native/utils';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { shouldRedirectToSetPasswordBefore2024 } from '@/hooks/useLock';

const { isSameAddress } = addressUtils;

export const RestoreFromCloud2024: React.FC<{
  onDone: () => void;
  shouldRedirect2SetPassword?: typeof shouldRedirectToSetPasswordBefore2024;
}> = ({ onDone, shouldRedirect2SetPassword }) => {
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

  const handleRestore = React.useCallback(async () => {
    onDone();
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SEED_PHRASE_RESTORE_FROM_CLOUD2024,
      bottomSheetModalProps: {
        snapPoints: [502],
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      shouldRedirect2SetPassword,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
      files: (backups || [])?.filter(item =>
        selectedFilenames.includes(item.filename),
      ),
    });
  }, [backups, shouldRedirect2SetPassword, onDone, selectedFilenames]);

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
        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.SEED_PHRASE_BACKUP_NOT_AVAILABLE,
          bottomSheetModalProps: {
            enableContentPanningGesture: true,
            enablePanDownToClose: true,
          },
          onConfirm: () => {
            removeGlobalBottomSheetModal2024(id);
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

  if (!backups?.length && !loading) {
    return (
      <NormalScreenContainer
        noHeader
        overwriteStyle={styles.loadingContainer}
        style={StyleSheet.flatten([styles.rootLoading])}>
        <View style={styles.empty}>
          <BackupIcon status="info" isGray isDown={true} />
          <Text style={styles.restoreTitle}>
            {t('screens.addressStackTitle.RestoreFromCloud', {
              type: IS_IOS ? 'iCloud' : 'Google Drive',
            })}
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
    <View style={styles.screenContainer}>
      <View style={styles.body}>
        <BottomSheetHandlableView>
          <View>
            <BackupIcon
              status={loading ? 'loading' : undefined}
              isGray
              isDown={true}
            />
            <Text style={styles.restoreTitle}>
              {t('screens.addressStackTitle.RestoreFromCloud', {
                type: IS_IOS ? 'iCloud' : 'Google Drive',
              })}
            </Text>
          </View>
        </BottomSheetHandlableView>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={styles.backupList}>
          {loading ? (
            <>
              <BackupItemSkeleton />
              <BackupItemSkeleton />
            </>
          ) : (
            backups?.map((item, index) => {
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
        </ScrollView>
      </View>
      <Button
        title={t('global.confirm')}
        onPress={handleRestore}
        disabled={!len || loading}
        containerStyle={styles.importConfirm}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(ctx => ({
  loading: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    backgroundColor: 'transparent',
  },
  empty: {
    alignItems: 'center',
    marginTop: 20,
  },
  btnContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 56,
    paddingHorizontal: 24,
  },
  restoreTitle: {
    marginTop: 25,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    color: ctx.colors2024['neutral-title-1'],
  },
  loadingText: {
    marginTop: 14,
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 17,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
  },
  root: {},
  rootLoading: {
    // justifyContent: 'center',
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    marginTop: 24,
    textAlign: 'center',
  },
  screenContainer: {
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 0,
    height: '100%',
    flex: 1,
    justifyContent: 'space-between',
  },
  body: {
    marginTop: 20,
    display: 'flex',
    flex: 1,
  },
  backupItem: {
    marginBottom: 12,
  },
  backupList: {
    marginTop: 32,
    marginBottom: 20,
    flex: 1,
  },
  loadingList: {
    marginTop: 32,
    paddingHorizontal: 25,
  },
  importConfirm: {
    marginBottom: 56,
  },
}));
