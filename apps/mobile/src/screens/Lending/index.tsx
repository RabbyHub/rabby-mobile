import React, { useCallback } from 'react';
import { Platform, View } from 'react-native';

import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import {
  DappFrameAccountHeader,
  DappSelectItem,
} from '@/components2024/DappFrameAccountHeader';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { Account } from '@/core/services/preference';
import {
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { useInitOpenDetail } from './hooks/useInitOpenDetail';
import MyAssetHome from './MyAssetHome';

const isAndroid = Platform.OS === 'android';

type LendingNativeScreenProps = {
  activeId: string;
  dappList: DappSelectItem[];
  onSelectDapp: (item: DappSelectItem) => void;
};

export function LendingNativeScreen({
  activeId,
  dappList,
  onSelectDapp,
}: LendingNativeScreenProps): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  useInitOpenDetail();
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const handleSelectAccount = useCallback(
    (account: Account) => {
      switchSceneCurrentAccount('Lending', account);
    },
    [switchSceneCurrentAccount],
  );

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={styles.overwriteStyle}>
      <DappFrameAccountHeader
        account={finalSceneCurrentAccount || undefined}
        onSelectAccount={handleSelectAccount}
        activeId={activeId}
        dAppList={dappList}
        onSelectDapp={onSelectDapp}
      />
      <AccountSwitcherModal forScene="Lending" inScreen />
      <View style={styles.container}>
        <MyAssetHome />
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  header: {
    height: isAndroid ? 46 : 44,
  },
  container: {
    flex: 1,
  },
}));
