import { useCallback } from 'react';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { getDisplayUserTokenSettingsSync } from '@/hooks/useTokenSettings';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type UserTokenSettingsState = ReturnType<
  typeof getDisplayUserTokenSettingsSync
>;

const loadingsByLabelState = zCreate(() => ({
  '@loadToken': false,
  '@batchLoadCacheTokens': false,
  '@checkIsExpireAndUpdate': false,
}));
type LoadingsByLabelState = ReturnType<typeof loadingsByLabelState.getState>;
export function setLoadingByLabel(
  label: keyof LoadingsByLabelState,
  loading: boolean,
) {
  loadingsByLabelState.setState(prev => ({
    ...prev,
    [label]: loading,
  }));
}

const userTokenSettingsState = zCreate<UserTokenSettingsState>(() => {
  return getDisplayUserTokenSettingsSync();
});

function setUserTokenSettings(
  valOrFunc: UpdaterOrPartials<UserTokenSettingsState>,
) {
  userTokenSettingsState.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}
const loadUserTokenSettings = () => {
  setUserTokenSettings(prev => {
    if (Object.keys(prev).length > 0) return prev;

    return getDisplayUserTokenSettingsSync();
  });
};

export const useSelectTokensThreadSafe = () => {
  const { fetchAccounts } = useAccountInfo();

  const userTokenSettings = userTokenSettingsState(s => s);

  const fetchAccountsAndTokenSettings = useCallback(async () => {
    fetchAccounts();
    loadUserTokenSettings();
  }, [fetchAccounts]);

  return {
    userTokenSettings,
    fetchAccountsAndTokenSettings,
  };
};
