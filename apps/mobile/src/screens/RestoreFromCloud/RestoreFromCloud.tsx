import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { BackupIcon } from '@/components/SeedPhraseBackupToCloud/BackupIcon';
import {
  BackupStats,
  getBackupsStatsFromCloud,
} from '@/core/utils/cloudBackup';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { BackupItem } from './BackupItem';

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

export const RestoreFromCloud = () => {
  const [backupsStats, setBackupsStats] = React.useState<BackupStats[]>();
  const [loading, setLoading] = React.useState(true);
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const [selectedFilenames, setSelectedFilenames] = React.useState<string[]>(
    [],
  );

  React.useEffect(() => {
    getBackupsStatsFromCloud().then(result => {
      setBackupsStats(result);
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
        removeGlobalBottomSheetModal(id);
      },
      filenames: selectedFilenames,
    });
  }, [selectedFilenames]);

  const handleSelect = React.useCallback((filename: string) => {
    setSelectedFilenames(prev => {
      if (prev.includes(filename)) {
        return prev.filter(i => i !== filename);
      }
      return [...prev, filename];
    });
  }, []);

  if (loading || !backupsStats) {
    return (
      <NormalScreenContainer
        style={StyleSheet.flatten([loading && styles.rootLoading])}>
        <View style={styles.loading}>
          <BackupIcon status="restoring" />
          <Text style={styles.loadingText}>
            {t('page.newAddress.seedPhrase.backupRestoreLoadingText')}
          </Text>
        </View>
      </NormalScreenContainer>
    );
  }

  return (
    <FooterButtonScreenContainer
      onPressButton={handleRestore}
      btnProps={{
        disabled: !selectedFilenames.length,
      }}
      buttonText={t('page.newAddress.seedPhrase.backupRestoreButton', {
        count: selectedFilenames.length,
      })}>
      <View style={styles.body}>
        <View>
          <BackupIcon status="success" />
          <Text style={styles.title}>
            {t('page.newAddress.seedPhrase.backupRestoreTitle', {
              count: backupsStats.length,
            })}
          </Text>
        </View>
        <View style={styles.backupList}>
          {backupsStats.map((item, index) => {
            const selected = selectedFilenames.includes(item.filename);
            return (
              <BackupItem
                key={index}
                item={item}
                selected={selected}
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
