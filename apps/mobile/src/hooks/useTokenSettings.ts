import { preferenceService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type UserTokenSettingsState = Awaited<
  ReturnType<typeof preferenceService.getUserTokenSettings>
>;
const userTokenSettingsStore = zCreate<UserTokenSettingsState>(() => {
  return {
    foldTokens: [],
    unfoldTokens: [],
    includeDefiAndTokens: [],
    excludeDefiAndTokens: [],
    pinedQueue: [],
    foldNfts: [],
    unfoldNfts: [],
    foldDefis: [],
    unFoldDefis: [],
    ...preferenceService.getUserTokenSettings(),
  };
});

function setUserTokenSettings(
  valOrFunc: UpdaterOrPartials<UserTokenSettingsState>,
) {
  userTokenSettingsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function getUserTokenSettingsInMemory() {
  return userTokenSettingsStore.getState();
}

const fetchUserTokenSettings = async () => {
  const data = await preferenceService.getUserTokenSettings();
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
