import { zustandByMMKV } from '@/core/storage/mmkv';
import { zCreate } from '@/core/utils/reexports';
import { parseMarkdown } from '@/components/Markdown/parseMarkdown';

type UpgradePromptInfo = {
  version: string;
  couldUpgrade: boolean;
  autoPrompt?: boolean;
  changelog: string;
};

// 按版本记录已展示或配置明确不提示的更新，新版本仍可再次判断。
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

// 处理记录只和对应版本号关联，新版本仍会再次判断。
function hasPromptedVersion(version: string) {
  const { lastPromptedVersion } = upgradePromptReceiptStore.getState();
  return lastPromptedVersion === version;
}

// 自动检查完成后先缓存，等待进入首页时再展示。
export function requestAutoUpgradePrompt(info: UpgradePromptInfo) {
  if (!info.couldUpgrade || hasPromptedVersion(info.version)) {
    return;
  }

  if (info.autoPrompt !== true) {
    // 缺失或请求失败不落处理记录，允许后续补配置或网络恢复后重新判断。
    if (info.autoPrompt === false) {
      upgradePromptReceiptStore.setState({ lastPromptedVersion: info.version });
    }
    return;
  }

  if (
    typeof info.changelog !== 'string' ||
    !parseMarkdown(info.changelog).success
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

// 设置页主动检查更新时不受忽略记录限制，但 changelog 为空或解析失败时不展示。
export function showUpgradePrompt(version: string, changelog: string) {
  if (!parseMarkdown(changelog).success) {
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
