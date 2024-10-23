import { useState, useMemo, useRef, useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import { getVersion } from 'react-native-device-info';

import Toast from 'react-native-root-toast';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';

import { atomByMMKV } from '@/core/storage/mmkv';

import { useEffect } from 'react';
import {
  DownloadLatestApkResult,
  MergedRemoteVersion,
  downloadLatestApk,
  getUpgradeInfo,
} from '@/utils/version';
import { BUILD_CHANNEL, isNonPublicProductionEnv } from '@/constant/env';
import { APP_URLS } from '@/constant';
import { toast } from '@/components/Toast';
import { useUnmountedRef } from './common/useMount';

const appLocalVersion = getVersion();
const RemoteVersionAtom = atomByMMKV<MergedRemoteVersion>(
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

const localVersionAtom = atom<string>(appLocalVersion);

export function useUpgradeInfo(options?: { isTop?: boolean }) {
  const { isTop = false } = options || {};

  const [remoteVersion, setRemoteVersion] = useAtom(RemoteVersionAtom);
  const [localVersion, setLocalVersion] = useAtom(localVersionAtom);

  const loadRemoteVersion = useCallback(async () => {
    return getUpgradeInfo().then(result => {
      setRemoteVersion(result.finalRemoteInfo);
      setLocalVersion(result.localVersion);

      return result;
    });
  }, [setLocalVersion, setRemoteVersion]);

  const openedModalIdRef = useRef<string>('');
  const triggerCheckVersion = useCallback(
    async (options?: Parameters<typeof getUpgradeInfo>[0]) => {
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
    },
    [setRemoteVersion],
  );

  useEffect(() => {
    if (isTop) loadRemoteVersion();
  }, [isTop, loadRemoteVersion]);

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
  const [localVersion, setLocalVersion] = useAtom(localVersionAtom);
  const { triggerCheckVersion } = useUpgradeInfo();

  const forceLocalVersion = useCallback(
    (version: string) => {
      if (!isNonPublicProductionEnv) return;

      setLocalVersion(version);
      triggerCheckVersion({ forceLocalVersion: version });
    },
    [setLocalVersion, triggerCheckVersion],
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
