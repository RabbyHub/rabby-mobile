import { useState, useMemo, useRef, useCallback } from 'react';
import { getVersion } from 'react-native-device-info';

import Toast from 'react-native-root-toast';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';

import { zustandByMMKV } from '@/core/storage/mmkv';

import {
  DownloadLatestApkResult,
  MergedRemoteVersion,
  downloadLatestApk,
  getUpgradeInfo,
} from '@/utils/version';
import { BUILD_CHANNEL } from '@/constant/env';
import { APP_URLS, isNonPublicProductionEnv } from '@/constant';
import { toast } from '@/components/Toast';
import { useUnmountedRef } from './common/useMount';
import { zCreate } from '@/core/utils/reexports';
import { RefLikeObject } from '@/utils/type';

const appLocalVersion = getVersion();

const remoteVersionStore = zustandByMMKV<MergedRemoteVersion>(
  '@RemoteVersionMMKV',
  {
    version: appLocalVersion,
    downloadUrl: APP_URLS.DOWNLOAD_PAGE,
    externalUrlToOpen: '',
    storeUrl: null,
    source: BUILD_CHANNEL,
    couldUpgrade: false,
    changelog: '',
  },
);
function setRemoteVersion(val: MergedRemoteVersion) {
  remoteVersionStore.setState(val);
}
const localVersionStore = zCreate<string>(() => appLocalVersion);
function setLocalVersion(val: string) {
  localVersionStore.setState(val);
}

const loadRemoteVersion = async () => {
  return getUpgradeInfo().then(result => {
    setRemoteVersion(result.finalRemoteInfo);
    setLocalVersion(result.localVersion);

    return result;
  });
};

export function loadVersionInfoOnBootstrap() {
  loadRemoteVersion().catch(error => {
    console.error('Load remote version info failed', error);
  });
}

const openedModalIdRef: RefLikeObject<string> = { current: '' };
const triggerCheckVersion = async (
  options?: Parameters<typeof getUpgradeInfo>[0],
) => {
  if (openedModalIdRef.current) return;
  openedModalIdRef.current = 'checking';

  return getUpgradeInfo(options)
    .then(result => {
      setRemoteVersion(result.finalRemoteInfo);

      if (!result.finalRemoteInfo.couldUpgrade) {
        toast.success('You are using the latest version', {
          position: Toast.positions.BOTTOM,
        });
      } else {
        openedModalIdRef.current = createGlobalBottomSheetModal({
          name: MODAL_NAMES.TIP_UPGRADE,
          title: 'New Version',
          bottomSheetModalProps: {
            onDismiss: () => {
              removeGlobalBottomSheetModal(openedModalIdRef.current);
              openedModalIdRef.current = '';
            },
          },
        });
      }
    })
    .catch(error => {
      openedModalIdRef.current = '';

      console.error('Check version failed', error);
      toast.info('Check version failed', {
        position: Toast.positions.BOTTOM,
      });
    });
};

export function useUpgradeInfo() {
  const remoteVersion = remoteVersionStore(s => s);
  const localVersion = localVersionStore(s => s);

  return {
    localVersion,
    remoteVersion,
    triggerCheckVersion,
  };
}

/**
 * @warning make sure this hook only used on non-production environment
 */
export function useForceLocalVersionForNonProduction() {
  const localVersion = localVersionStore(s => s);
  const { triggerCheckVersion } = useUpgradeInfo();

  const forceLocalVersion = useCallback(
    (version: string) => {
      if (!isNonPublicProductionEnv) return;

      setLocalVersion(version);
      triggerCheckVersion({ forceLocalVersion: version });
    },
    [triggerCheckVersion],
  );

  return {
    currentLocalVersion: localVersion,
    forceLocalVersion,
  };
}

const DEFAULT_PROGRESS = {
  percent: 0,
  downloadResult: null,
  downloadedApkPath: null,
};
export const enum DownloadStage {
  'none',
  'downloaded',
  'downloading',
  'connecting',
}
export function useDownloadLatestApk() {
  const [progressInfo, setProgressInfo] = useState<{
    percent: number;
    downloadResult: DownloadLatestApkResult['downloadResult'] | null;
    downloadedApkPath: string | null;
  }>({ ...DEFAULT_PROGRESS });
  const downloadingPromiseRef = useRef<ReturnType<
    typeof downloadLatestApk
  > | null>(null);

  const unmountedRef = useUnmountedRef();

  const startDownload = useCallback(async () => {
    if (downloadingPromiseRef.current) return downloadingPromiseRef.current;

    downloadingPromiseRef.current = downloadLatestApk({
      onProgress: ctx => {
        if (unmountedRef.current) return;

        setProgressInfo(prev => ({
          ...prev,
          percent: ctx.progressPercent,
          downloadedApkPath: ctx.localApkPath,
        }));
      },
    })
      .then(res => {
        if (unmountedRef.current) return res;

        setProgressInfo(prev => ({
          ...prev,
          downloadResult: res.downloadResult,
          downloadedApkPath: res.downloadedApkPath,
        }));
        return res;
      })
      .finally(() => {
        downloadingPromiseRef.current = null;
      });

    return downloadingPromiseRef.current;
  }, [setProgressInfo, unmountedRef]);

  const resetProgress = useCallback(() => {
    setProgressInfo({ ...DEFAULT_PROGRESS });
    downloadingPromiseRef.current = null;
  }, [setProgressInfo]);

  const downloadStage = useMemo(() => {
    if (!downloadingPromiseRef.current) return DownloadStage.none;

    if (progressInfo.percent >= 1) return DownloadStage.downloaded;
    if (progressInfo.percent > 0) return DownloadStage.downloading;

    return DownloadStage.connecting;
  }, [progressInfo.percent]);

  return {
    progressInfo,

    progressPercentText: `${Math.floor(progressInfo.percent * 100)}%`,
    downloadStage,
    startDownload,
    resetProgress,
  };
}
