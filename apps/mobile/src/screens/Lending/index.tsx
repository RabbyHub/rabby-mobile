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
import { useFetchLendingData, useSelectedMarket } from './hooks';
import { LendingNativeHeader } from './components/LendingHeaderTitle';
import MyAssetHome from './MyAssetHome';
import useProtocols from '@/store/protocols';
import { marketKeyToProtocolId } from '../Home/utils/protocolConfig';

function DashBoardScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const { fetchData } = useFetchLendingData();
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const updateSpecificProtocol = useProtocols(
    state => state.updateSpecificProtocol,
  );

  const { chainInfo, marketKey } = useSelectedMarket();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePendingClear = useCallback(() => {
    setTimeout(() => {
      fetchData(true);

      // lending和 protocol 两个数据源，这里让两个数据源看着更加一致
      const protocolId = marketKeyToProtocolId(marketKey);
      if (
        protocolId &&
        finalSceneCurrentAccount?.address &&
        chainInfo?.serverId
      ) {
        updateSpecificProtocol(
          finalSceneCurrentAccount?.address,
          protocolId,
          chainInfo?.serverId,
        );
      }
    }, 200);
  }, [
    chainInfo?.serverId,
    fetchData,
    finalSceneCurrentAccount?.address,
    marketKey,
    updateSpecificProtocol,
  ]);

  return (
    <NormalScreenContainer2024
      type="bg1"
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
  },
}));

export default ForMultipleAddress;
