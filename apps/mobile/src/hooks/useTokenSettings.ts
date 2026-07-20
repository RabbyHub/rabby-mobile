import {
  getUserTokenSettings,
  getUserTokenSettingsSnapshot,
  pinUserToken,
  removePinnedUserToken,
  type UserTokenSettings,
} from '@/core/serviceApi/preference';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import { filterCustomTestnetUserTokenSettings } from '@/utils/favoriteToken';

type UserTokenSettingsState = UserTokenSettings;

export const getDisplayUserTokenSettingsSync = (): UserTokenSettingsState => {
  return filterCustomTestnetUserTokenSettings(getUserTokenSettingsSnapshot());
};

export const getDisplayUserTokenSettings =
  async (): Promise<UserTokenSettingsState> => {
    return filterCustomTestnetUserTokenSettings(await getUserTokenSettings());
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
  // TODO: improve, can only update tokens about list on store
  void pinUserToken({
    tokenId: token.id,
    chainId: token.chain,
  }).then(fetchUserTokenSettings);
};

const removePinedToken = <T extends { id: string; chain: string }>(
  token: T,
) => {
  // TODO: improve, can only update tokens about list on store
  void removePinnedUserToken({
    tokenId: token.id,
    chainId: token.chain,
  }).then(fetchUserTokenSettings);
};

export function isUserTokenPinnedInMemory<
  T extends { id: string; chain: string },
>(token: T) {
  return userTokenSettingsStore
    .getState()
    .pinedQueue.some(
      pinned => pinned.chainId === token.chain && pinned.tokenId === token.id,
    );
}

export function toggleUserTokenPinned<T extends { id: string; chain: string }>(
  token: T,
) {
  if (isUserTokenPinnedInMemory(token)) {
    removePinedToken(token);
  } else {
    pinToken(token);
  }
}

export function useIsUserTokenPinned<T extends { id: string; chain: string }>(
  token: T,
) {
  return userTokenSettingsStore(state =>
    state.pinedQueue.some(
      pinned => pinned.chainId === token.chain && pinned.tokenId === token.id,
    ),
  );
}

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
