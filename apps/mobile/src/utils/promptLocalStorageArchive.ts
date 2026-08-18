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
    const sharedParts = [
      !result.archive.dismissed && 'archive',
      !result.keyringDump.dismissed && 'keyring dump',
    ].filter(Boolean);

    if (sharedParts.length > 0) {
      toast.success(`${sharedParts.join(' and ')} ready to share`);
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
    'This opens two share dialogs: a ZIP with the current raw MMKV and SQLite files, then a JSON dump of raw keyring MMKV values. They can include wallet and keyring data. Share them only with a trusted recipient.',
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
