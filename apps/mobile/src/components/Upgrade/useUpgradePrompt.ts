import { zustandByMMKV } from '@/core/storage/mmkv';
import { zCreate } from '@/core/utils/reexports';

type UpgradePromptInfo = {
  version: string;
  couldUpgrade: boolean;
};

// 按版本记录用户已忽略的更新，后续出现更高版本时仍可再次提示。
const upgradePromptReceiptStore = zustandByMMKV<{
  lastDismissedVersion: string;
}>('@UpgradePromptReceiptMMKV', {
  lastDismissedVersion: '',
});

const upgradePromptStore = zCreate(() => ({
  visible: false,
  version: '',
}));

// 忽略状态只和当前提示的版本号关联，新版本仍会再次提示。
function hasDismissedVersion(version: string) {
  const { lastDismissedVersion } = upgradePromptReceiptStore.getState();
  // return lastDismissedVersion === version;
  return false;
}

// 版本请求已处于统一的 Home 启动后空闲阶段，这里直接决定是否展示。
export function requestAutoUpgradePrompt(info: UpgradePromptInfo) {
  // if (!info.couldUpgrade || hasDismissedVersion(info.version)) return;

  showUpgradePrompt(info.version);
}

// 设置页主动检查更新时直接展示，不受自动提示的忽略记录限制。
export function showUpgradePrompt(version: string) {
  upgradePromptStore.setState({ visible: true, version });
}

// 关闭时记录当前弹窗对应的版本，避免同一版本后续自动重复提示。
export function dismissUpgradePrompt() {
  const { version } = upgradePromptStore.getState();
  if (version) {
    upgradePromptReceiptStore.setState({ lastDismissedVersion: version });
  }

  upgradePromptStore.setState({ visible: false, version: '' });
}

export function isUpgradePromptVisible() {
  return upgradePromptStore.getState().visible;
}

export function useUpgradePromptVisible() {
  return upgradePromptStore(state => state.visible);
}
