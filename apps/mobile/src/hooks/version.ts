import { useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { getVersion } from 'react-native-device-info';

import { atomByMMKV } from '@/core/storage/mmkv';

import { writeAtom } from '@/components/JotaiNexus';
import { useEffect } from 'react';
import { MergedRemoteVersion, getUpgradeInfo } from '@/utils/version';
import { AppBuildChannel, BUILD_CHANNEL } from '@/constant/env';
import { APP_URLS } from '@/constant';

const RemoteVersionAtom = atomByMMKV<MergedRemoteVersion>('RemoteVersionMMKV', {
  version: getVersion(),
  downloadUrl: APP_URLS.DOWNLOAD_PAGE,
  storeUrl: null,
  source: BUILD_CHANNEL,
  couldUpgrade: false,
});

export function useRemoteUpgradeInfo(options?: { isTop?: boolean }) {
  const { isTop = false } = options || {};

  const [remoteVersion, setRemoteVersion] = useAtom(RemoteVersionAtom);

  const loadRemoteVersion = useCallback(async () => {
    return getUpgradeInfo().then(result => {
      setRemoteVersion(result.finalRemoteInfo);

      return result;
    });
  }, [setRemoteVersion]);

  useEffect(() => {
    if (isTop) loadRemoteVersion();
  }, [isTop, loadRemoteVersion]);

  return {
    remoteVersion,
    loadRemoteVersion,
  };
}
