import { isNonPublicProductionEnv, NEED_DEVSETTINGBLOCKS } from '@/constant';
import { zustandByMMKV } from '@/core/storage/mmkv';

type StartupRuntimePanelSetting = {
  enabled: boolean;
};

const disabledState: StartupRuntimePanelSetting = {
  enabled: false,
};

const startupRuntimePanelStore =
  NEED_DEVSETTINGBLOCKS && isNonPublicProductionEnv
    ? zustandByMMKV<StartupRuntimePanelSetting>(
        '@FloatingStartupRuntimePanel',
        disabledState,
      )
    : null;

export function toggleShowStartupRuntimePanel(nextEnabled?: boolean) {
  if (
    !NEED_DEVSETTINGBLOCKS ||
    !isNonPublicProductionEnv ||
    !startupRuntimePanelStore
  ) {
    return false;
  }

  let finalValue = false;
  startupRuntimePanelStore.setState(previous => {
    finalValue =
      typeof nextEnabled === 'boolean' ? nextEnabled : !previous.enabled;
    return {
      enabled: finalValue,
    };
  });
  return finalValue;
}

export function useToggleShowStartupRuntimePanel() {
  const showStartupRuntimePanel = startupRuntimePanelStore
    ? startupRuntimePanelStore(state => state.enabled)
    : false;

  return {
    showStartupRuntimePanel,
    toggleShowStartupRuntimePanel,
  };
}
