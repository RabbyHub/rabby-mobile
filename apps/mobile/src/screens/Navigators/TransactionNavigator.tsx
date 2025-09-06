import 'react-native-gesture-handler';
import React from 'react';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useStackScreenConfig } from '@/hooks/navigation';
import {
  RootNames,
  makeHeadersPresets,
  makeTxPageBackgroundColors,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import SendScreen from '../Send/Send';
import SendNFTScreen from '../SendNFT/SendNFT';

import { HistoryDetailScreen } from '../Transaction/HistoryDetailScreen';
import { HistoryLocalDetailScreen } from '../Transaction/HistoryLocalDetailScreen';
import { TransactionNavigatorParamList } from '@/navigation-type';
import Swap from '../Swap';
import ApprovalsScreen from '../Approvals';
import ReceiveScreen from '../Receive/Receive';
import { Bridge } from '../Bridge';
import { GasAccountScreen } from '../GasAccount';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import MultiAddressHistory from '../Transaction/MultiAddressHistory';
import { BuyScreen } from '../Buy';
import SendPolyScreen from '../Send/SubScreens/SelectPolyScreen';
import SendInputScreen from '../Send/SubScreens/SendInput';
import SelectMyAddressScreen from '../Send/SubScreens/SelectMyAddress';
import SelectWatchScreenScreen from '../Send/SubScreens/SelectTypeAddress';
import { CopyTradingScreen } from '../CopyTrading';
import { GnosisQueueScreen } from '../GnosisQueue';
import WhitelistInputScreen from '../WhiteList/InputScreen';
import { BatchRevokeScreen } from '../BatchRevoke/BatchRevoke';
import { useTranslation } from 'react-i18next';
import CopyTradingTokenDetail from '../CopyTrading/component/CopyTradingTokenDetail';
import { PerpsScreen } from '../Perps';
import { PerpsMarketListScreen } from '../PerpsMarketList';
import { PerpsMarketDetailScreen } from '../PerpsMarketDetail';
import { PerpsHistoryScreen } from '../PerpsHistory';
const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

export default function TransactionNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const { t } = useTranslation();
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
          title: 'Select Imported Wallet',
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
        component={SendScreen.ForMultipleAddress}
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
        component={MultiAddressHistory}
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
        component={MultiAddressHistory.ForSingleAddress}
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
        component={Swap}
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
        component={Swap.ForMultipleAddress}
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
        component={Bridge}
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
        component={Bridge.ForMultipleAddress}
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
        name={RootNames.CopyTrading}
        component={CopyTradingScreen}
        options={mergeScreenOptions({
          title: t('page.home.services.copyTrading'),
          ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Perps}
        component={PerpsScreen}
        options={mergeScreenOptions({
          title: t('page.home.services.perps'),
          // ...headerPresets.withBgCard1_2024,
          // headerStyle: {
          //   backgroundColor: colors2024['neutral-bg-2'],
          // },
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.PerpsMarketList}
        component={PerpsMarketListScreen}
        options={mergeScreenOptions({
          title: t('page.home.services.perpsMarketList'),
          // ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.PerpsMarketDetail}
        component={PerpsMarketDetailScreen}
        options={mergeScreenOptions({
          // title: t('page.home.services.perpsMarketDetail'),
          // ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.PerpsHistory}
        component={PerpsHistoryScreen}
        options={mergeScreenOptions({
          title: t('page.perpsHistory.title'),
          // ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.CopyTradingTokenDetail}
        component={CopyTradingTokenDetail}
        options={mergeScreenOptions({
          headerShown: true,
          headerTitleAlign: 'left',
          headerTitle: '',
          headerStyle: {
            // backgroundColor: colors['neutral-bg-2'],
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
        component={BuyScreen.ForMultipleAddress}
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
