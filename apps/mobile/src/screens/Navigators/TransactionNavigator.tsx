import React from 'react';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { useStackScreenConfig } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';

import HistoryScreen from '@/screens/Transaction/History';
import SendScreen from '../Send/Send';
import HistoryFilterScamScreen from '../Transaction/HistoryFilterScamScreen';
const TransactionStack = createNativeStackNavigator();

export default function TransactionNavigator() {
  const screenOptions = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const colors = useThemeColors();

  return (
    <TransactionStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
      }}>
      <TransactionStack.Screen
        name={RootNames.History}
        component={HistoryScreen}
        options={{
          title: 'History',
        }}
      />
      <TransactionStack.Screen
        name={RootNames.Send}
        component={SendScreen}
        options={{
          ...screenOptions,
          title: 'Send',
          headerStyle: {
            backgroundColor: colors['neutral-card2'],
          },
          headerTintColor: colors['neutral-title-1'],
          headerShadowVisible: false,
          headerShown: true,
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
    </TransactionStack.Navigator>
  );
}
