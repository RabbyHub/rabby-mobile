import { zustandByMMKV } from '@/core/storage/mmkv';
import { zCreate } from '@/core/utils/reexports';

type UpgradePromptInfo = {
  version: string;
  couldUpgrade: boolean;
  changelog: string;
};

// 按版本记录已经展示过的更新，后续出现更高版本时仍可再次提示。
const upgradePromptReceiptStore = zustandByMMKV<{
  lastPromptedVersion: string;
}>('@UpgradePromptReceiptMMKV', {
  lastPromptedVersion: '',
});

const upgradePromptStore = zCreate<{
  visible: boolean;
  version: string;
  pendingInfo: UpgradePromptInfo | null;
}>(() => ({
  visible: false,
  version: '',
  pendingInfo: null,
}));

// 展示记录只和当前提示的版本号关联，新版本仍会再次提示。
function hasPromptedVersion(version: string) {
  const { lastPromptedVersion } = upgradePromptReceiptStore.getState();
  return lastPromptedVersion === version;
}

// 自动检查完成后先缓存，等待进入首页时再展示。
export function requestAutoUpgradePrompt(info: UpgradePromptInfo) {
  if (
    !info.couldUpgrade ||
    hasPromptedVersion(info.version) ||
    !info.changelog.trim()
  ) {
    return;
  }

  upgradePromptStore.setState({ pendingInfo: info });
}

export function showPendingAutoUpgradePrompt() {
  const { pendingInfo } = upgradePromptStore.getState();
  if (!pendingInfo) {
    return;
  }

  upgradePromptStore.setState({ pendingInfo: null });
  if (hasPromptedVersion(pendingInfo.version)) {
    return;
  }

  showUpgradePrompt(pendingInfo.version, pendingInfo.changelog);
}

// 设置页主动检查更新时不受忽略记录限制，但 changelog 为空时不展示。
export function showUpgradePrompt(version: string, changelog: string) {
  if (!changelog.trim()) {
    return;
  }

  upgradePromptReceiptStore.setState({ lastPromptedVersion: version });
  upgradePromptStore.setState({ visible: true, version });
}

export function dismissUpgradePrompt() {
  upgradePromptStore.setState({ visible: false, version: '' });
}

export function isUpgradePromptVisible() {
  return upgradePromptStore.getState().visible;
}

export function useUpgradePromptVisible() {
  return upgradePromptStore(state => state.visible);
}

export function usePendingAutoUpgradePrompt() {
  return upgradePromptStore(state => state.pendingInfo);
}

export function useLastPromptedUpgradeVersion() {
  return upgradePromptReceiptStore(state => state.lastPromptedVersion);
}

export function resetUpgradePromptExposure() {
  upgradePromptReceiptStore.setState({ lastPromptedVersion: '' });
}
