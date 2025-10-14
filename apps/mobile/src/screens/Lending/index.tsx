import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
  Platform,
} from 'react-native';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTranslation } from 'react-i18next';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { CHAINS_ENUM } from '@debank/common';
import { ChainSelector } from './ChainSelector';

const isAndroid = Platform.OS === 'android';

function DashBoardScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [chainEnum, setChainEnum] = useState<CHAINS_ENUM>(CHAINS_ENUM.ETH);
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  console.log('CUSTOM_LOGGER:=>: currentAccount', currentAccount?.address);

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={styles.overwriteStyle}>
      <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      <View>
        <ChainSelector chainEnum={chainEnum} onChange={setChainEnum} />
        <Text>Lending</Text>
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
}));

export default ForMultipleAddress;
