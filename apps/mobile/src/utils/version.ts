import { Linking, Platform } from 'react-native';
import VersionCheck from 'react-native-version-check';
import Toast from 'react-native-root-toast';
import semver from 'semver';
import RNFS from 'react-native-fs';

import { toast } from '@/components/Toast';
import { devLog } from './logger';

import { AppBuildChannel, BUILD_CHANNEL } from '@/constant/env';
import { APPLICATION_ID, APP_URLS, APP_VERSIONS } from '@/constant';

export type RemoteVersionRes = {
  version?: string;
  downloadUrl?: string;
  versionDesc?: string;
  forceUpdate?: boolean;
};

export type MergedRemoteVersion = {
  version: string;
  downloadUrl: string;
  storeUrl: string | null;
  changelog: string;
  source: AppBuildChannel;
  couldUpgrade: boolean;
};

export function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const isAndroid = Platform.OS === 'android';
const isSelfHostProd = BUILD_CHANNEL === 'selfhost';

export const SELF_HOST_BASE = `https://download.rabby.io/downloads/${
  isSelfHostProd
    ? `wallet-mobile`
    : isAndroid
    ? `wallet-mobile-reg`
    : `wallet-mobile-pretest`
}`;

const RES_BASE_URL = `${SELF_HOST_BASE}/${isAndroid ? 'android' : 'ios'}`;
const VERSION_JSON_URL = `${RES_BASE_URL}/version.json`;

const ANDROID_DOWNLOAD_LINK = `${SELF_HOST_BASE}/android/rabby-mobile.apk`;
function getLatestApkPath() {
  // const targetBase = `${RNFS.DocumentDirectoryPath}/install`
  const targetBase = `${RNFS.CachesDirectoryPath}/install`;
  RNFS.mkdir(targetBase);

  return `${targetBase}/${APPLICATION_ID}.apk`;
}
export type DownloadLatestApkResult = {
  downloadResult: RNFS.DownloadResult;
  downloadedApkPath: string;
  targetUrl: string;
};
export async function downloadLatestApk(options?: {
  onProgress?: (ctx: {
    progressPercent: number;
    downloadCallbackRes: RNFS.DownloadProgressCallbackResult;
    localApkPath: string | null;
  }) => void;
}) {
  const localApkPath = getLatestApkPath();
  const { onProgress } = options || {};

  const download = RNFS.downloadFile({
    fromUrl: ANDROID_DOWNLOAD_LINK,
    toFile: localApkPath,
    progress: res => {
      const progressPercent = Number(
        (res.bytesWritten / res.contentLength).toFixed(2),
      );
      console.log('progressPercent', progressPercent);

      onProgress?.({
        progressPercent,
        downloadCallbackRes: res,
        localApkPath: progressPercent >= 1 ? localApkPath : null,
      });
    },
    readTimeout: 60 * 1e3,
    progressDivider: 1,
  });

  return download.promise.then(downloadResult => {
    return {
      downloadResult,
      downloadedApkPath: localApkPath,
      targetUrl: ANDROID_DOWNLOAD_LINK,
    } as DownloadLatestApkResult;
  });
}

export async function getUpgradeInfo() {
  // use version from package.json on devlopment
  const localVersion = APP_VERSIONS.forCheckUpgrade;

  // allow store check failed, fallback to compare with version.json
  const storeVersion = await Promise.race([
    VersionCheck.getLatestVersion({
      // ...isAndroid ? {
      //   provider: 'playStore',
      //   packageName: 'com.debank.rabbymobile'
      // } : {
      //   provider: 'appStore',
      //   packageName: 'com.debank.rabby-mobile',
      // },
      country: 'us',
    }).catch(() => null),
    // if the network is not available, it will return null
    sleep(1000).then(() => null),
  ]);

  let selfHostUpgrade: RemoteVersionRes = {};
  try {
    const res = await fetch(VERSION_JSON_URL);
    selfHostUpgrade = await res.json();
  } catch (err) {
    console.error('fetch version.json failed', err);
    selfHostUpgrade = {};
  }

  const storeUrl = await VersionCheck.getStoreUrl().catch(
    () => APP_URLS.STORE_URL,
  );

  const finalRemoteInfo: MergedRemoteVersion = {
    version: localVersion,
    downloadUrl: APP_URLS.DOWNLOAD_PAGE,
    storeUrl,
    source: BUILD_CHANNEL,
    couldUpgrade: false,
    changelog: '',
  };

  switch (BUILD_CHANNEL) {
    case 'selfhost':
    case 'selfhost-reg':
      if (!isAndroid) {
        finalRemoteInfo.version = storeVersion || APP_URLS.STORE_URL;
        finalRemoteInfo.downloadUrl = storeUrl;
      } else if (
        selfHostUpgrade?.version &&
        semver.gt(selfHostUpgrade.version, localVersion)
      ) {
        finalRemoteInfo.version = selfHostUpgrade.version;
        finalRemoteInfo.downloadUrl = APP_URLS.DOWNLOAD_PAGE;
      }
      break;
    case 'appstore':
      finalRemoteInfo.version = storeVersion || localVersion;
      finalRemoteInfo.downloadUrl = storeUrl;
      break;
  }

  finalRemoteInfo.couldUpgrade = semver.gt(
    finalRemoteInfo.version,
    localVersion,
  );

  try {
    finalRemoteInfo.changelog = await fetch(
      `${RES_BASE_URL}/${finalRemoteInfo.version}.md`,
    )
      .then(res => {
        if (res.status === 200) {
          return res.text();
        }

        return '';
      })
      .catch(() => '');
  } catch (error) {
    console.error('fetch changelog failed', error);
    finalRemoteInfo.changelog = '';
  }

  return {
    localVersion,
    storeVersion,
    selfHostUpgrade,
    finalRemoteInfo,
  };
}

export async function checkVersion() {
  try {
    const { finalRemoteInfo } = await getUpgradeInfo();

    devLog('finalRemoteInfo', finalRemoteInfo);

    if (finalRemoteInfo.couldUpgrade) {
      const targetUrl =
        finalRemoteInfo.downloadUrl ||
        finalRemoteInfo.storeUrl ||
        APP_URLS.DOWNLOAD_PAGE;
      Linking.openURL(targetUrl);
    } else {
      toast.success('You are using the latest version', {
        position: Toast.positions.BOTTOM,
      });
    }
    return finalRemoteInfo;
  } catch (error) {
    console.error('checkVersion', error);
    toast.info('Check version failed', {
      position: Toast.positions.BOTTOM,
    });
    return false;
  }
}
