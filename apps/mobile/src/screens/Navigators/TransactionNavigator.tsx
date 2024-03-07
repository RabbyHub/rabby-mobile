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
const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

export default function TransactionNavigator() {
  const screenOptions = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const colors = useThemeColors();

  const headerPresets = makeHeadersPresets({ colors });

  return (
    <TransactionStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        ...headerPresets.withBgCard2,
        headerShadowVisible: false,
        headerShown: true,
      }}>
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
        options={{
          ...screenOptions,
          title: 'Send',
          ...headerPresets.withBgCard2,
        }}
      />
      <TransactionStack.Screen
        name={RootNames.HistoryFilterScam}
        component={HistoryFilterScamScreen}
        options={{
          title: 'Hide scam transactions',
        }}
      />
      {/* ReceiveScreen */}
      {/* SwapScreen */}
      <TransactionStack.Screen
        name={RootNames.Swap}
        component={Swap}
        options={{
          ...screenOptions,
          title: 'Swap',
          ...headerPresets.withBgCard2,
        }}
      />
    </TransactionStack.Navigator>
  );
}
