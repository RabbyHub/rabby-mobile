import { Linking, Platform } from 'react-native';
import VersionCheck from 'react-native-version-check';
import semver from 'semver';
import { toast } from '@/components/Toast';
import Toast from 'react-native-root-toast';
import { devLog } from './logger';
import { RemoteVersionRes, setRemoteVersion } from '@/hooks/version';
import { BUILD_CHANNEL } from '@/constant/env';
import { APP_URLS, APP_VERSIONS } from '@/constant';

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

async function getUpgradeInfo() {
  // use version from package.json on devlopment
  const localVersion = APP_VERSIONS.forCheckUpgrade;
  // const defaultDownloadUrl = isAndroid ? `${SELF_HOST_BASE}/android/rabby-mobile.apk` : APP_URLS.DOWNLOAD_PAGE;
  const defaultDownloadUrl = APP_URLS.DOWNLOAD_PAGE;

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

  const finalRemoteInfo = {
    version: localVersion,
    downloadUrl: defaultDownloadUrl,
    storeUrl,
    source: BUILD_CHANNEL,
    needUpgrade: false,
  };

  if (storeVersion && selfHostUpgrade?.version) {
    if (semver.gte(storeVersion, selfHostUpgrade?.version)) {
      finalRemoteInfo.version = storeVersion;
      finalRemoteInfo.downloadUrl = await VersionCheck.getStoreUrl();
      finalRemoteInfo.source = 'appstore';
    } else if (isAndroid) {
      finalRemoteInfo.version = selfHostUpgrade.version;
      finalRemoteInfo.downloadUrl =
        selfHostUpgrade.downloadUrl || defaultDownloadUrl;
      finalRemoteInfo.source = BUILD_CHANNEL;
    }
  }

  finalRemoteInfo.needUpgrade = semver.gt(
    finalRemoteInfo.version,
    localVersion,
  );

  if (
    finalRemoteInfo?.version &&
    semver.gt(finalRemoteInfo.version, localVersion)
  ) {
    setRemoteVersion({
      ...selfHostUpgrade,
      version: finalRemoteInfo.version,
      downloadUrl: finalRemoteInfo.downloadUrl,
    });
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

    if (finalRemoteInfo.needUpgrade) {
      Linking.openURL(finalRemoteInfo.downloadUrl || finalRemoteInfo.storeUrl);
    } else {
      toast.success('You are using the latest version', {
        position: Toast.positions.BOTTOM,
      });
    }
  } catch (error) {
    console.error('checkVersion', error);
    toast.info('Check version failed', {
      position: Toast.positions.BOTTOM,
    });
    return false;
  }
}
