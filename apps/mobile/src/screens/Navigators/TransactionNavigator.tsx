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
import { GnosisQueueScreen } from '../GnosisQueue';
import { BatchRevokeScreen } from '../BatchRevoke/BatchRevoke';
import { useTranslation } from 'react-i18next';
import { PerpsScreen } from '../Perps';
import { PerpsMarketDetailScreen } from '../PerpsMarketDetail';
import { PerpsHistoryScreen } from '../PerpsHistory';
import LendingHistory from '../Lending/components/LendingHistory';
import AAVEScreen from '../Lending';

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
        name={RootNames.LendingHistory}
        component={LendingHistory}
        options={{
          title: 'Lending History',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
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
        name={RootNames.Lending}
        component={AAVEScreen}
        options={mergeScreenOptions({
          title: t('page.home.services.lending'),
          ...headerPresets.withBgCard1_2024,
          headerTitle: ctx => {
            return (
              <ScreenHeaderAccountSwitcher
                forScene="Lending"
                titleText={ctx.children}
              />
            );
          },
          headerTintColor: colors['neutral-title-1'],
          headerStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />
    </TransactionStack.Navigator>
  );
}
