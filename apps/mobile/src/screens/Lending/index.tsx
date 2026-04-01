import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useFetchLendingData } from './hooks';
import { LendingNativeHeader } from './components/LendingHeaderTitle';
import { useInitOpenDetail } from './hooks/useInitOpenDetail';
import MyAssetHome from './MyAssetHome';

function DashBoardScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { fetchData } = useFetchLendingData();
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  useInitOpenDetail();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePendingClear = useCallback(() => {
    setTimeout(() => {
      fetchData(true);
    }, 200);
  }, [fetchData]);

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={styles.overwriteStyle}>
      <LendingNativeHeader
        account={finalSceneCurrentAccount}
        onPendingClear={handlePendingClear}
      />
      <AccountSwitcherModal forScene="Lending" inScreen />
      <View style={styles.container}>
        <MyAssetHome />
      </View>
    </NormalScreenContainer2024>
  );
}

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof DashBoardScreen>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'Lending',
        ofScreen: 'Lending',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-Lending`,
      }}>
      <DashBoardScreen {...props} />
    </ScreenSceneAccountProvider>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
  },
}));

export default ForMultipleAddress;
