import 'react-native-gesture-handler';
import React from 'react';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { useStackScreenConfig } from '@/hooks/navigation';
import {
  RootNames,
  makeHeadersPresets,
  makeTxPageBackgroundColors,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { registerAppScreen } from '@/perfs/apis';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import { TransactionNavigatorParamList } from '@/navigation-type';

const SendScreen = registerAppScreen<typeof import('../Send/Send').default>({
  loader: () => import('../Send/Send'),
  name: RootNames.Send,
});
const SendScreenForMultipleAddress = registerAppScreen<
  typeof import('../Send/Send').default['ForMultipleAddress']
>({
  loader: () => import('../Send/Send').then(m => m.default.ForMultipleAddress),
  name: RootNames.MultiSend,
});
const SendNFTScreen = registerAppScreen<
  typeof import('../SendNFT/SendNFT').default
>({
  loader: () => import('../SendNFT/SendNFT'),
  name: RootNames.SendNFT,
});
const HistoryFilterScamScreen = registerAppScreen<
  typeof import('../Transaction/HistoryFilterScamScreen').default
>({
  loader: () => import('../Transaction/HistoryFilterScamScreen'),
  name: RootNames.HistoryFilterScam,
});
const HistoryDetailScreen = registerAppScreen<
  typeof import('../Transaction/HistoryDetailScreen').HistoryDetailScreen
>({
  loader: () =>
    import('../Transaction/HistoryDetailScreen').then(
      m => m.HistoryDetailScreen,
    ),
  name: RootNames.HistoryDetail,
});
const HistoryLocalDetailScreen = registerAppScreen<
  typeof import('../Transaction/HistoryLocalDetailScreen').HistoryLocalDetailScreen
>({
  loader: () =>
    import('../Transaction/HistoryLocalDetailScreen').then(
      m => m.HistoryLocalDetailScreen,
    ),
  name: RootNames.HistoryLocalDetail,
});
const SwapScreen = registerAppScreen<typeof import('../Swap').default>({
  loader: () => import('../Swap'),
  name: RootNames.Swap,
});
const SwapScreenForMultipleAddress = registerAppScreen<
  typeof import('../Swap').default['ForMultipleAddress']
>({
  loader: () => import('../Swap').then(m => m.default.ForMultipleAddress),
  name: RootNames.MultiSwap,
});
const ApprovalsScreen = registerAppScreen<
  typeof import('../Approvals').default
>({
  loader: () => import('../Approvals'),
  name: RootNames.Approvals,
});
const ReceiveScreen = registerAppScreen<
  typeof import('../Receive/Receive').default
>({
  loader: () => import('../Receive/Receive'),
  name: RootNames.Receive,
});
const BridgeScreen = registerAppScreen<typeof import('../Bridge').Bridge>({
  loader: () => import('../Bridge').then(m => m.Bridge),
  name: RootNames.Bridge,
});
const BridgeScreenForMultipleAddress = registerAppScreen<
  typeof import('../Bridge').Bridge['ForMultipleAddress']
>({
  loader: () => import('../Bridge').then(m => m.Bridge.ForMultipleAddress),
  name: RootNames.MultiBridge,
});
const GasAccountScreen = registerAppScreen<
  typeof import('../GasAccount').GasAccountScreen
>({
  loader: () => import('../GasAccount').then(m => m.GasAccountScreen),
  name: RootNames.GasAccount,
});
const MultiAddressHistoryScreen = registerAppScreen<
  typeof import('../Transaction/MultiAddressHistory').default
>({
  loader: () => import('../Transaction/MultiAddressHistory'),
  name: RootNames.MultiAddressHistory,
});
const MultiAddressHistoryForSingleAddressScreen = registerAppScreen<
  typeof import('../Transaction/MultiAddressHistory').default['ForSingleAddress']
>({
  loader: () =>
    import('../Transaction/MultiAddressHistory').then(
      m => m.default.ForSingleAddress,
    ),
  name: RootNames.History,
});
const BuyScreen = registerAppScreen<typeof import('../Buy').BuyScreen>({
  loader: () => import('../Buy').then(m => m.BuyScreen),
  name: RootNames.Buy,
});
const BuyScreenForMultipleAddress = registerAppScreen<
  typeof import('../Buy').BuyScreen['ForMultipleAddress']
>({
  loader: () => import('../Buy').then(m => m.BuyScreen.ForMultipleAddress),
  name: RootNames.MultiBuy,
});
const SendPolyScreen = registerAppScreen<
  typeof import('../Send/SubScreens/SelectPolyScreen').default
>({
  loader: () => import('../Send/SubScreens/SelectPolyScreen'),
  name: RootNames.SendTo,
});
const SendInputScreen = registerAppScreen<
  typeof import('../Send/SubScreens/SendInput').default
>({
  loader: () => import('../Send/SubScreens/SendInput'),
  name: RootNames.SendInput,
});
const SelectMyAddressScreen = registerAppScreen<
  typeof import('../Send/SubScreens/SelectMyAddress').default
>({
  loader: () => import('../Send/SubScreens/SelectMyAddress'),
  name: RootNames.SelectImportAddress,
});
const SelectWatchScreenScreen = registerAppScreen<
  typeof import('../Send/SubScreens/SelectTypeAddress').default
>({
  loader: () => import('../Send/SubScreens/SelectTypeAddress'),
  name: RootNames.SelectTypeAddress,
});
const SendHistoryScreen = registerAppScreen<
  typeof import('../WhiteList/SelectSendTransationAddress').default
>({
  loader: () => import('../WhiteList/SelectSendTransationAddress'),
  name: RootNames.SendHistory,
});
const GnosisQueueScreen = registerAppScreen<
  typeof import('../GnosisQueue').GnosisQueueScreen
>({
  loader: () => import('../GnosisQueue').then(m => m.GnosisQueueScreen),
  name: RootNames.GnosisTransactionQueue,
});
const WhitelistInputScreen = registerAppScreen<
  typeof import('../WhiteList/InputScreen').default
>({
  loader: () => import('../WhiteList/InputScreen'),
  name: RootNames.WhitelistInput,
});
const BatchRevokeScreen = registerAppScreen<
  typeof import('../BatchRevoke/BatchRevoke').BatchRevokeScreen
>({
  loader: () =>
    import('../BatchRevoke/BatchRevoke').then(m => m.BatchRevokeScreen),
  name: RootNames.BatchRevoke,
});

const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

export default function TransactionNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const { colors, colors2024, isLight } = useTheme2024();
  const headerPresets = makeHeadersPresets({ colors, colors2024 });

  return (
    <TransactionStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        ...headerPresets.withBgCard2,
        headerShadowVisible: false,
        headerShown: true,
      })}>
      <TransactionStack.Screen
        name={RootNames.SendTo}
        component={SendPolyScreen}
        options={mergeScreenOptions({
          title: 'Send to',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.SendHistory}
        component={SendHistoryScreen}
        options={mergeScreenOptions({
          title: 'Select Address to add',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.SendInput}
        component={SendInputScreen}
        options={mergeScreenOptions({
          title: 'Send to',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.WhitelistInput}
        component={WhitelistInputScreen}
        options={mergeScreenOptions({
          title: 'Add New Whitelist Address',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '800',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.SelectImportAddress}
        component={SelectMyAddressScreen}
        options={mergeScreenOptions({
          title: 'Select Imported Address',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.SelectTypeAddress}
        component={SelectWatchScreenScreen}
        options={mergeScreenOptions({
          title: '',
        })}
      />
      <TransactionStack.Screen
        name={RootNames.Send}
        component={SendScreen}
        options={mergeScreenOptions({
          title: 'Send',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.MultiSend}
        component={SendScreenForMultipleAddress}
        options={mergeScreenOptions({
          title: 'Send',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.SendNFT}
        component={SendNFTScreen}
        options={mergeScreenOptions({
          title: 'Send NFT',
          ...headerPresets.withBg2,
        })}
      />
      <TransactionStack.Screen
        name={RootNames.Receive}
        component={ReceiveScreen}
        options={mergeScreenOptions({
          title: 'Receive',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.MultiAddressHistory}
        component={MultiAddressHistoryScreen}
        options={{
          title: 'Transactions',
          headerTitle: ctx => {
            return (
              <ScreenHeaderAccountSwitcher
                forScene="MultiHistory"
                titleText={ctx.children}
              />
            );
          },
          headerStyle: {
            backgroundColor: makeTxPageBackgroundColors({
              isLight,
              colors2024,
            }),
          },
        }}
      />
      <TransactionStack.Screen
        name={RootNames.History}
        component={MultiAddressHistoryForSingleAddressScreen}
        options={{
          title: 'Transactions',
          headerTitle: ctx => {
            return (
              <ScreenHeaderAccountSwitcher
                forScene="History"
                titleText={ctx.children}
                disableSwitch
              />
            );
          },
          headerStyle: {
            backgroundColor: makeTxPageBackgroundColors({
              isLight,
              colors2024,
            }),
          },
        }}
      />
      <TransactionStack.Screen
        name={RootNames.HistoryFilterScam}
        component={HistoryFilterScamScreen}
        options={mergeScreenOptions({
          headerTitle: 'Hide scam transactions',
          title: 'Hide scam transactions',
          ...headerPresets.withBgCard2,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: colors2024?.['neutral-bg-1'],
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.HistoryDetail}
        component={HistoryDetailScreen}
        options={mergeScreenOptions({
          title: '',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: !isLight
              ? colors2024?.['neutral-bg-1']
              : colors2024?.['neutral-bg-2'],
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.HistoryLocalDetail}
        component={HistoryLocalDetailScreen}
        options={mergeScreenOptions({
          title: '',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: !isLight
              ? colors2024?.['neutral-bg-1']
              : colors2024?.['neutral-bg-2'],
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.GnosisTransactionQueue}
        component={GnosisQueueScreen}
        options={mergeScreenOptions({
          title: 'Queue',
          ...headerPresets.withBgCard2,
        })}
      />
      {/* ReceiveScreen */}
      {/* SwapScreen */}
      <TransactionStack.Screen
        name={RootNames.Swap}
        component={SwapScreen}
        options={mergeScreenOptions2024([
          {
            title: 'Swap',
            headerTitle: ctx => {
              return (
                <ScreenHeaderAccountSwitcher
                  forScene="MakeTransactionAbout"
                  titleText={ctx.children}
                  disableSwitch
                />
              );
            },
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.MultiSwap}
        component={SwapScreenForMultipleAddress}
        options={mergeScreenOptions2024([
          {
            title: 'Swap',
            headerTitle: ctx => {
              return (
                <ScreenHeaderAccountSwitcher
                  forScene="MakeTransactionAbout"
                  titleText={ctx.children}
                />
              );
            },
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.Approvals}
        component={ApprovalsScreen}
        options={mergeScreenOptions({
          title: 'Approvals',
          ...headerPresets.withBgCard2_2024,
        })}
      />

      <TransactionStack.Screen
        name={RootNames.BatchRevoke}
        component={BatchRevokeScreen}
        options={mergeScreenOptions({
          title: 'Batch Revoke',
          ...headerPresets.withBgCard2_2024,
          headerStyle: {},
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Bridge}
        component={BridgeScreen}
        options={mergeScreenOptions2024([
          {
            title: 'Bridge',
            // ...headerPresets.withBgCard1_2024,
            headerTitle: ctx => {
              return (
                <ScreenHeaderAccountSwitcher
                  forScene="MakeTransactionAbout"
                  titleText={ctx.children}
                  disableSwitch
                />
              );
            },
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.MultiBridge}
        component={BridgeScreenForMultipleAddress}
        options={mergeScreenOptions2024([
          {
            title: 'Bridge',
            // ...headerPresets.withBgCard1_2024,
            headerTitle: ctx => {
              return (
                <ScreenHeaderAccountSwitcher
                  forScene="MakeTransactionAbout"
                  titleText={ctx.children}
                />
              );
            },
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.GasAccount}
        component={GasAccountScreen}
        options={mergeScreenOptions({
          title: 'GasAccount',
          ...headerPresets.withBgCard2_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: 'transparent',
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Buy}
        component={BuyScreen}
        options={mergeScreenOptions({
          title: 'Buy',
          // ...headerPresets.withBgCard1_2024,
          headerTitle: ctx => {
            return (
              <ScreenHeaderAccountSwitcher
                forScene="MakeTransactionAbout"
                titleText={ctx.children}
                disableSwitch
              />
            );
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.MultiBuy}
        component={BuyScreenForMultipleAddress}
        options={mergeScreenOptions({
          title: 'Buy',
          // ...headerPresets.withBgCard1_2024,
          headerTitle: ctx => {
            return (
              <ScreenHeaderAccountSwitcher
                forScene="MakeTransactionAbout"
                titleText={ctx.children}
              />
            );
          },
        })}
      />
    </TransactionStack.Navigator>
  );
}
