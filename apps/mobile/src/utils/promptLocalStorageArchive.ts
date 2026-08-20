import { Alert } from 'react-native';

import { isNonPublicProductionEnv } from '@/constant';
import { shareCurrentLocalStorageArchive } from '@/core/storage/localStorageArchive';
import { toast } from '@/components2024/Toast';

let isPromptVisible = false;
let isExportInProgress = false;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function exportAndShareLocalStorageArchive() {
  if (isExportInProgress) {
    return;
  }

  isExportInProgress = true;

  try {
    toast.show('Preparing local storage archive...');
    const result = await shareCurrentLocalStorageArchive();
    if (!result.dismissed) {
      toast.success(
        `Archive with ${result.mmkvDumpCount} MMKV dumps and ${result.keyringStartupDiagnosticFileCount} startup diagnostic files ready to share`,
      );
    }
  } catch (error) {
    Alert.alert('Local storage export failed', getErrorMessage(error));
  } finally {
    isExportInProgress = false;
  }
}

export function promptLocalStorageArchiveShare() {
  if (!isNonPublicProductionEnv || isPromptVisible || isExportInProgress) {
    return;
  }

  isPromptVisible = true;

  Alert.alert(
    'Export local storage?',
    'This creates one ZIP with the current raw MMKV and SQLite files, JSON dumps for every known MMKV storage, and preserved pre-React-Native keyring snapshots. It can include wallet and keyring data. Share it only with a trusted recipient.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          isPromptVisible = false;
        },
      },
      {
        text: 'Export and Share',
        style: 'destructive',
        onPress: () => {
          isPromptVisible = false;
          void exportAndShareLocalStorageArchive();
        },
      },
    ],
    {
      cancelable: true,
      onDismiss: () => {
        isPromptVisible = false;
      },
    },
  );
}
