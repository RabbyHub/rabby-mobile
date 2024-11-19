/**
 * Sample React Native HomeScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, { useCallback, useMemo } from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';

import HeaderArea from './MultiAddressHeaderArea';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useTheme2024, useThemeStyles } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import { keyringService } from '@/core/services';
import { RootNames } from '@/constant/layout';
import { useAccounts, useCurrentAccount } from '@/hooks/account';
import {
  createGetStyles,
  createGetStyles2024,
  makeDebugBorder,
} from '@/utils/styles';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import RcIconSend from '@/assets2024/icons/home/IconSend.svg';
import RcIconReceive from '@/assets2024/icons/home/IconReceive.svg';
import RcIconSwap from '@/assets2024/icons/home/IconSwap.svg';
import RcIconBridge from '@/assets2024/icons/home/IconBridge.svg';
import RcIconHistory from '@/assets2024/icons/home/IconHistory.svg';
import RcIconApprovals from '@/assets2024/icons/home/IconApprovals.svg';
import RcIconGasAccount from '@/assets2024/icons/home/IconGasAccount.svg';
import RcIconDapps from '@/assets2024/icons/home/IconDapps.svg';
import RcIconEcosystem from '@/assets2024/icons/home/IconEcosystem.svg';
import RcIconPoints from '@/assets2024/icons/home/IconPoints.svg';

const MENU_ARR = [
  {
    title: 'Send',
    icon: RcIconSend,
  },
  {
    title: 'Receive',
    icon: RcIconReceive,
  },
  {
    title: 'Swap',
    icon: RcIconSwap,
  },
  {
    title: 'Bridge',
    icon: RcIconBridge,
  },
  {
    title: 'History',
    icon: RcIconHistory,
  },
  {
    title: 'Approvals',
    icon: RcIconApprovals,
  },
  {
    title: 'GasAccount',
    icon: RcIconGasAccount,
  },
  {
    title: 'Dapps',
    icon: RcIconDapps,
  },
  {
    title: 'Ecosystem',
    icon: RcIconEcosystem,
  },
  {
    title: 'Rabby Points',
    icon: RcIconPoints,
  },
];

function MultiAddressHome(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const filterAccounts = React.useMemo(
    () =>
      [...accounts].filter(
        a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
      ),
    [accounts],
  );

  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  const HeaderTitle = useMemo(
    () => (
      <MultiAddressHome.HeaderArea
        key={currentAccount?.address}
        accountLen={filterAccounts.length}
      />
    ),
    [filterAccounts.length, currentAccount?.address],
  );

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => HeaderTitle,
      headerLeft: () => null,
      headerRight: () => null,
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [colors, navigation, setNavigationOptions, HeaderTitle, colors2024]);

  const init = useMemoizedFn(async () => {
    const resAccounts = await keyringService.getAllVisibleAccountsArray();
    if (!resAccounts?.length) {
      navigation.dispatch(
        StackActions.replace(RootNames.StackGetStarted, {
          screen: RootNames.GetStartedScreen2024,
        }),
      );
      // navigate(RootNames.StackAddress, {
      //   screen: RootNames.ImportNewAddress,
      // });
    } else if (__DEV__) {
      // debug only
      // navigation.dispatch(
      //   StackActions.replace(RootNames.StackSettings, {
      //     screen: RootNames.SetPassword,
      //   }),
      // );
      // navigation.dispatch(
      //   StackActions.replace(RootNames.Unlock),
      // );
    }
  });

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init]),
  );

  return (
    <RootScreenContainer fitStatuBar style={styles.rootScreenContainer}>
      <SafeAreaView style={styles.safeView}>
        <View style={[styles.grid]}>
          {MENU_ARR.map((e, index) => {
            return (
              <View style={styles.gridItem} key={index}>
                <e.icon />
                <Text>{e.title}</Text>
              </View>
            );
          })}
        </View>
      </SafeAreaView>
    </RootScreenContainer>
  );
}

MultiAddressHome.HeaderArea = HeaderArea;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  rootScreenContainer: {
    backgroundColor: colors2024['neutral-bg-1'],
    // ...makeDebugBorder(),
  },
  safeView: {
    flex: 1,
    overflow: 'hidden',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  gridItem: {
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-bg-2'],
    width: '48%',
    minWidth: 0,
    borderRadius: 12,
    flexShrink: 0,

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
}));

export default MultiAddressHome;
