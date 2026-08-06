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

const upgradePromptStore = zCreate(() => ({
  visible: false,
  version: '',
}));

// 展示记录只和当前提示的版本号关联，新版本仍会再次提示。
function hasPromptedVersion(version: string) {
  const { lastPromptedVersion } = upgradePromptReceiptStore.getState();
  // return lastPromptedVersion === version;
  return false;
}

// 版本请求已处于统一的 Home 启动后空闲阶段，这里直接决定是否展示。
export function requestAutoUpgradePrompt(info: UpgradePromptInfo) {
  // if (!info.couldUpgrade || hasPromptedVersion(info.version)) return;

  showUpgradePrompt(info.version, info.changelog);
}

// 设置页主动检查更新时不受忽略记录限制，但 changelog 为空时不展示。
export function showUpgradePrompt(version: string, changelog: string) {
  if (!changelog.trim()) return;

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
