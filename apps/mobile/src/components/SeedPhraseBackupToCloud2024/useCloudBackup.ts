import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components2024/Toast';
import { IS_IOS } from '@/core/native/utils';
import {
  decryptFiles,
  getBackupsFromCloud,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';

export type UseCloudBackupParams = {
  seedPhrase: string;
  onDone: () => void;
};

export function useCloudBackup({ seedPhrase, onDone }: UseCloudBackupParams) {
  const { t } = useTranslation();

  const handleUpload = React.useCallback(
    async (password: string) => {
      if (!password) {
        toast.show('must have password');
        return;
      }

      try {
        const filename = await saveMnemonicToCloud({
          mnemonic: seedPhrase,
          password,
        });
        const files = await getBackupsFromCloud([filename]);
        await decryptFiles({ password, files });
        toast.success(
          IS_IOS
            ? t('page.newAddress.seedPhrase.backupSuccessICloud')
            : t('page.newAddress.seedPhrase.backupSuccessGDrive'),
        );
        onDone();
      } catch {
        toast.error(t('page.newAddress.seedPhrase.backupFailedTitle'));
      }
    },
    [seedPhrase, onDone, t],
  );

  return { handleUpload };
}
