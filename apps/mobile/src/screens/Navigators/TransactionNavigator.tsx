import 'react-native-gesture-handler';
import React from 'react';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { useStackScreenConfig } from '@/hooks/navigation';
import {
  DEFAULT_NAVBAR_FONT_SIZE,
  RootNames,
  ScreenWithAccountSwitcherLayouts,
  makeHeadersPresets,
} from '@/constant/layout';
import { useTheme2024, useThemeColors } from '@/hooks/theme';

import SendScreen from '../Send/Send';
import SendNFTScreen from '../SendNFT/SendNFT';

import HistoryFilterScamScreen from '../Transaction/HistoryFilterScamScreen';
import { TransactionNavigatorParamList } from '@/navigation-type';
import Swap from '../Swap';
import ApprovalsScreen from '../Approvals';
import ReceiveScreen from '../Receive/Receive';
import { GnosisTransactionQueue } from '../GnosisTransactionQueue';
import { Bridge } from '../Bridge';
import { GasAccountScreen } from '../GasAccount';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import HistoryScreen from '../Transaction/History';
import MultiAddressHistory from '../Transaction/MultiAddressHistory';

const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

export default function TransactionNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const colors = useThemeColors();
  const { colors2024 } = useTheme2024();

  const headerPresets = makeHeadersPresets({ colors });

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
        options={mergeScreenOptions({
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
        })}
      />

      <TransactionStack.Screen
        name={RootNames.MultiSwap}
        component={Swap.ForMultipleAddress}
        options={mergeScreenOptions({
          title: 'Swap',
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
        name={RootNames.Approvals}
        component={ApprovalsScreen}
        options={mergeScreenOptions({
          title: 'Approvals',
          ...headerPresets.withBgCard2,
          headerStyle: {
            backgroundColor: colors?.['neutral-bg-2'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Bridge}
        component={Bridge}
        options={mergeScreenOptions({
          title: 'Bridge',
          ...headerPresets.withBgCard2,
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
        name={RootNames.MultiBridge}
        component={Bridge.ForMultipleAddress}
        options={mergeScreenOptions({
          title: 'Bridge',
          ...headerPresets.withBgCard2,
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
        name={RootNames.GasAccount}
        component={GasAccountScreen}
        options={mergeScreenOptions({
          title: 'GasAccount',
          ...headerPresets.withBgCard2,
        })}
      />
    </TransactionStack.Navigator>
  );
}
