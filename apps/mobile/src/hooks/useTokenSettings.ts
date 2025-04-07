import { preferenceService } from '@/core/services';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';

const userTokenSettingsAtom = atom<
  Awaited<ReturnType<typeof preferenceService.getUserTokenSettings>>
>({
  foldTokens: [],
  unfoldTokens: [],
  includeDefiAndTokens: [],
  excludeDefiAndTokens: [],
  pinedQueue: [],
  foldNfts: [],
  unfoldNfts: [],
  foldDefis: [],
  unFoldDefis: [],
});

userTokenSettingsAtom.onMount = set => {
  preferenceService.getUserTokenSettings().then(set);
};

export const useUserTokenSettings = () => {
  const [userTokenSettings, setUserTokenSettings] = useAtom(
    userTokenSettingsAtom,
  );

  const fetchUserTokenSettings = useCallback(async () => {
    const data = await preferenceService.getUserTokenSettings();
    setUserTokenSettings(data);
  }, [setUserTokenSettings]);

  const pinToken = useCallback(
    <T extends { id: string; chain: string }>(token: T) => {
      preferenceService.pinToken({
        tokenId: token.id,
        chainId: token.chain,
      });
      fetchUserTokenSettings();
    },
    [fetchUserTokenSettings],
  );

  const removePinedToken = useCallback(
    <T extends { id: string; chain: string }>(token: T) => {
      preferenceService.removePinedToken({
        tokenId: token.id,
        chainId: token.chain,
      });
      fetchUserTokenSettings();
    },
    [fetchUserTokenSettings],
  );

  return {
    userTokenSettings,
    setUserTokenSettings,
    fetchUserTokenSettings,
    pinToken,
    removePinedToken,
  };
};
