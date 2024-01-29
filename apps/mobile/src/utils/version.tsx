import { Linking } from 'react-native';
import VersionCheck from 'react-native-version-check';
import { getVersion } from 'react-native-device-info';
import semver from 'semver';
import { toast } from '@/components/Toast';
import Toast from 'react-native-root-toast';

export function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkVersion() {
  try {
    // 允许商店检查失败，降级到 只比较 原来的 version.json
    const latestVersion = await Promise.race([
      VersionCheck.getLatestVersion({
        country: 'us',
      }).catch(() => null),
      // 超过 1000 视为无法访问 store
      sleep(1000).then(() => null),
    ]);

    const localVersion = getVersion();
    console.log('latestVersion', latestVersion);
    console.log(
      'await VersionCheck.getStoreUrl()',
      await VersionCheck.getStoreUrl(),
    );
    if (
      latestVersion &&
      localVersion &&
      semver.gt(latestVersion, localVersion)
    ) {
      const storeUrl = await VersionCheck.getStoreUrl();
      Linking.openURL(storeUrl);
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
