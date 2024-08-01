import 'react-native-gesture-handler';
import React from 'react';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { useStackScreenConfig } from '@/hooks/navigation';
import { RootNames, makeHeadersPresets } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';

import HistoryScreen from '@/screens/Transaction/History';
import SendScreen from '../Send/Send';
import HistoryFilterScamScreen from '../Transaction/HistoryFilterScamScreen';
import { TransactionNavigatorParamList } from '@/navigation-type';
import Swap from '../Swap';
import GasTopUp from '../GasTopUp';
import ApprovalsScreen from '../Approvals';
import ReceiveScreen from '../Receive/Receive';
import { GnosisTransactionQueue } from '../GnosisTransactionQueue';
import { Bridge } from '../Bridge';

const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

export default function TransactionNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const colors = useThemeColors();

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
        name={RootNames.History}
        component={HistoryScreen}
        options={{
          title: 'History',
          ...headerPresets.withBgCard2,
        }}
      />
      <TransactionStack.Screen
        name={RootNames.Send}
        component={SendScreen}
        options={mergeScreenOptions({
          title: 'Send',
          ...headerPresets.withBg2,
        })}
      />
      <TransactionStack.Screen
        name={RootNames.Receive}
        component={ReceiveScreen}
        options={mergeScreenOptions({
          title: '',
          headerShadowVisible: false,
          headerShown: true,
          headerTransparent: true,
        })}
      />
      <TransactionStack.Screen
        name={RootNames.HistoryFilterScam}
        component={HistoryFilterScamScreen}
        options={{
          title: 'Hide scam transactions',
        }}
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
          ...headerPresets.withBg2,
        })}
      />

      <TransactionStack.Screen
        name={RootNames.GasTopUp}
        component={GasTopUp}
        options={mergeScreenOptions({
          title: 'Instant Gas Top Up',
          ...headerPresets.withBgCard2,
          headerTintColor: colors?.['neutral-title-2'],
          headerTitleStyle: {
            ...headerPresets.withBgCard2.headerTitleStyle,
            color: colors?.['neutral-title-2'],
          },
          headerStyle: {
            backgroundColor: 'transparent',
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
        options={{
          ...screenOptions,
          title: 'Bridge',
          ...headerPresets.withBgCard2,
        }}
      />
    </TransactionStack.Navigator>
  );
}
