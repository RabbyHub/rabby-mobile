import { Linking, Platform } from 'react-native';
import VersionCheck from 'react-native-version-check';
import semver from 'semver';
import { toast } from '@/components/Toast';
import Toast from 'react-native-root-toast';
import { devLog } from './logger';

import { AppBuildChannel, BUILD_CHANNEL } from '@/constant/env';
import { APP_URLS, APP_VERSIONS } from '@/constant';

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
const DEFAULT_STORE_URL = isAndroid
  ? 'https://play.google.com/store/apps/details?id=com.debank.rabbymobile'
  : '';

export const SELF_HOST_BASE = `https://download.rabby.io/downloads/${
  isSelfHostProd
    ? `wallet-mobile`
    : isAndroid
    ? `wallet-mobile-reg`
    : `wallet-mobile-pretest`
}`;

const VERSION_JSON_URL = isAndroid
  ? `${SELF_HOST_BASE}/android/version.json`
  : `${SELF_HOST_BASE}/ios/version.json`;

// const ANDROID_DOWNLOAD_LINK = `${SELF_HOST_BASE}/android/rabby-mobile.apk`;

export async function getUpgradeInfo() {
  // use version from package.json on devlopment
  const localVersion = APP_VERSIONS.forCheckUpgrade;

  // allow store check failed, fallback to compare with version.json
  const storeVersion = await Promise.race([
    VersionCheck.getLatestVersion({
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
    () => DEFAULT_STORE_URL,
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
      if (selfHostUpgrade?.version) {
        if (!isAndroid) {
          finalRemoteInfo.version = storeVersion || localVersion;
          finalRemoteInfo.downloadUrl = storeUrl;
        } else if (semver.gt(selfHostUpgrade.version, localVersion)) {
          finalRemoteInfo.version = selfHostUpgrade.version;
          finalRemoteInfo.downloadUrl = APP_URLS.DOWNLOAD_PAGE;
        }
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
