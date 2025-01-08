import { useCurrentAccount } from '@/hooks/account';
import { useFocusEffect } from '@react-navigation/native';

import {
  isSameAccount,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';

export function useKeepAccountOnSingleAddressBasedAssetDetailScreen() {
  const { currentAccount } = useCurrentAccount();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: '@AssetPageFromSingleAddress',
  });

  useFocusEffect(() => {
    if (!finalSceneCurrentAccount) return;
    if (
      !currentAccount ||
      !isSameAccount(currentAccount, finalSceneCurrentAccount)
    ) {
      switchSceneCurrentAccount(
        '@AssetPageFromSingleAddress',
        finalSceneCurrentAccount,
      );
    }
  });

  return { currentAccount, switchSceneCurrentAccount };
}
