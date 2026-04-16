import { useCallback } from 'react';

import RNFS from 'react-native-fs';

import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { getViewShotFilePath } from '@/utils/browser';

type InnerDappSnapshotState = {
  snapshotByKey: Record<string, string>;
};

const defaultState: InnerDappSnapshotState = {
  snapshotByKey: {},
};

const innerDappSnapshotStore = zustandByMMKV<InnerDappSnapshotState>(
  '@InnerDappSnapshot',
  defaultState,
  { storage: MMKVStorageStrategy.compatJson },
);

const removeSnapshotFile = async (fileName?: string) => {
  if (!fileName) {
    return;
  }
  const filePath = getViewShotFilePath(fileName);
  if (!filePath) {
    return;
  }
  try {
    if (await RNFS.exists(filePath)) {
      await RNFS.unlink(filePath);
    }
  } catch (e) {
    console.error('removeSnapshotFile', e);
  }
};

export function useInnerDappSnapshot() {
  const snapshotByKey = innerDappSnapshotStore(s => s.snapshotByKey);

  const saveSnapshot = useCallback(async (key: string, tempUri: string) => {
    if (!key || !tempUri) {
      return false;
    }

    const fileName = `screenshot-${key}-${Date.now()}.jpg`;
    const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await removeSnapshotFile(fileName);
    try {
      if (await RNFS.exists(filePath)) {
        await RNFS.unlink(filePath);
      }
      await RNFS.copyFile(tempUri, filePath);

      innerDappSnapshotStore.setState(prev => ({
        ...prev,
        snapshotByKey: {
          ...prev.snapshotByKey,
          [key]: fileName,
        },
      }));
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  const removeSnapshot = useCallback(async (key: string) => {
    if (!key) {
      return;
    }
    const prevPath = innerDappSnapshotStore.getState().snapshotByKey[key];
    if (prevPath) {
      await removeSnapshotFile(prevPath);
    }
    innerDappSnapshotStore.setState(prev => {
      if (!prev.snapshotByKey[key]) {
        return prev;
      }
      const next = { ...prev.snapshotByKey };
      delete next[key];
      return {
        ...prev,
        snapshotByKey: next,
      };
    });
  }, []);

  return {
    snapshotByKey,
    saveSnapshot,
    removeSnapshot,
  };
}
