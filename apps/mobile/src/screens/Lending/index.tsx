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
import PoolContainer from './PoolContainer';
import { useLendingData } from './hooks';
import { LendingHeader } from './components/Header';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
const isAndroid = Platform.OS === 'android';

function DashBoardScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { fetchData } = useLendingData(currentAccount?.address, true);

  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      <View style={styles.container}>
        <PoolContainer />
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
    forScene: 'MakeTransactionAbout',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'MakeTransactionAbout',
        ofScreen: 'MultiSwap',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiSwap`,
      }}>
      <DashBoardScreen {...props} />
    </ScreenSceneAccountProvider>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    paddingHorizontal: 16,
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
