import 'react-native-gesture-handler';
import React from 'react';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { useStackScreenConfig } from '@/hooks/navigation';
import { RootNames, makeHeadersPresets } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import SendScreen from '../Send/Send';
import SendNFTScreen from '../SendNFT/SendNFT';

import HistoryFilterScamScreen from '../Transaction/HistoryFilterScamScreen';
import { HistoryDetailScreen } from '../Transaction/HistoryDetailScreen';
import { HistoryLocalDetailScreen } from '../Transaction/HistoryLocalDetailScreen';
import { TransactionNavigatorParamList } from '@/navigation-type';
import Swap from '../Swap';
import ApprovalsScreen from '../Approvals';
import ReceiveScreen from '../Receive/Receive';
import { GnosisTransactionQueue } from '../GnosisTransactionQueue';
import { Bridge } from '../Bridge';
import { GasAccountScreen } from '../GasAccount';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import MultiAddressHistory from '../Transaction/MultiAddressHistory';
import { strings } from '@/utils/i18n';

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
        name={RootNames.Send}
        component={SendScreen}
        options={mergeScreenOptions({
          title: 'Send',
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
        name={RootNames.MultiSend}
        component={SendScreen.ForMultipleAddress}
        options={mergeScreenOptions({
          title: 'Send',
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
            fontWeight: '800',
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
            backgroundColor: colors2024?.['neutral-bg-1'],
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
            backgroundColor: colors2024?.['neutral-bg-1'],
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
            fontWeight: '800',
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
            fontWeight: '800',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: colors2024?.['neutral-bg-2'],
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
            fontWeight: '800',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: colors2024?.['neutral-bg-2'],
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.GnosisTransactionQueue}
        component={GnosisTransactionQueue}
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
        })}
      />
    </TransactionStack.Navigator>
  );
}
