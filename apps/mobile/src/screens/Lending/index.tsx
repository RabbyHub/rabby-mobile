import React, { useMemo, useState } from 'react';
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
import { CHAINS_ENUM } from '@debank/common';
import { ChainSelector } from './ChainSelector';
import SummaryCard from './SummaryCard';
import PoolContainer from './PoolContainer';
import { useLendingData, useLendingSummary } from './hooks';
import EmptySummaryCard from './EmptySummaryCard';

const isAndroid = Platform.OS === 'android';

function DashBoardScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const [chainEnum, setChainEnum] = useState<CHAINS_ENUM>(CHAINS_ENUM.ETH);
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  useLendingData(currentAccount?.address, true);
  const { apyInfo, iUserSummary, loading } = useLendingSummary();

  const isEmpty = useMemo(() => {
    return (
      loading || iUserSummary?.totalLiquidityMarketReferenceCurrency === '0'
    );
  }, [loading, iUserSummary]);

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={styles.overwriteStyle}>
      <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      <View style={styles.container}>
        <ChainSelector chainEnum={chainEnum} onChange={setChainEnum} />
        {isEmpty ? (
          <EmptySummaryCard />
        ) : (
          <SummaryCard
            netWorth={iUserSummary?.netWorthUSD || ''}
            supplied={iUserSummary?.totalLiquidityUSD || ''}
            borrowed={iUserSummary?.totalBorrowsUSD || ''}
            netApy={apyInfo?.netAPY || 0}
            healthFactor={iUserSummary?.healthFactor || ''}
          />
        )}
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
