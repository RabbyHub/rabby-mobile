import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useFetchLendingData, useSelectedMarket } from './hooks';
import { LendingHeader } from './components/Header';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useInitOpenDetail } from './hooks/useInitOpenDetail';
import MyAssetHome from './MyAssetHome';
const isAndroid = Platform.OS === 'android';

function DashBoardScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { fetchData } = useFetchLendingData();
  useInitOpenDetail();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const Header = React.useCallback(
    () => (
      <LendingHeader
        onPendingClear={() => {
          setTimeout(() => {
            fetchData(true);
          }, 200);
        }}
      />
    ),
    [fetchData],
  );

  useEffect(() => {
    setNavigationOptions({
      headerRight: Header,
    });
  }, [Header, setNavigationOptions]);

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={styles.overwriteStyle}>
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
  header: {
    height: isAndroid ? 46 : 44,
  },
  container: {
    flex: 1,
  },
}));

export default ForMultipleAddress;
