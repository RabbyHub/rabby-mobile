import { preferenceService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { filterCustomTestnetUserTokenSettings } from '@/utils/favoriteToken';

type UserTokenSettingsState = ReturnType<
  typeof preferenceService.getUserTokenSettingsSync
>;

export const getDisplayUserTokenSettingsSync = (): UserTokenSettingsState => {
  return filterCustomTestnetUserTokenSettings(
    preferenceService.getUserTokenSettingsSync(),
  );
};

export const getDisplayUserTokenSettings =
  async (): Promise<UserTokenSettingsState> => {
    return filterCustomTestnetUserTokenSettings(
      await preferenceService.getUserTokenSettings(),
    );
  };

const userTokenSettingsStore = zCreate<UserTokenSettingsState>(() => {
  return getDisplayUserTokenSettingsSync();
});

function setUserTokenSettings(
  valOrFunc: UpdaterOrPartials<UserTokenSettingsState>,
) {
  userTokenSettingsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return filterCustomTestnetUserTokenSettings(newVal);
  });
}

export function getUserTokenSettingsInMemory() {
  return userTokenSettingsStore.getState();
}

const fetchUserTokenSettings = async () => {
  const data = await getDisplayUserTokenSettings();
  setUserTokenSettings(data);
};

const pinToken = <T extends { id: string; chain: string }>(token: T) => {
  preferenceService.pinToken({
    tokenId: token.id,
    chainId: token.chain,
  });
  // TODO: improve, can only update tokens about list on store
  fetchUserTokenSettings();
};

const removePinedToken = <T extends { id: string; chain: string }>(
  token: T,
) => {
  preferenceService.removePinedToken({
    tokenId: token.id,
    chainId: token.chain,
  });
  // TODO: improve, can only update tokens about list on store
  fetchUserTokenSettings();
};

export const useUserTokenSettings = () => {
  const userTokenSettings = userTokenSettingsStore(s => s);

  return {
    userTokenSettings,
    setUserTokenSettings,
    fetchUserTokenSettings,
    pinToken,
    removePinedToken,
  };
};
