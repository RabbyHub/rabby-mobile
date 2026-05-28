import 'react-native-gesture-handler';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { HeaderBackPressable, useStackScreenConfig } from '@/hooks/navigation';
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
import ApprovalsScreen from '../Approvals';
import ReceiveScreen from '../Receive/Receive';
import SwapBridgeScreen from '../SwapBridge';
import { ConvertDustScreen } from '../ConvertDust';
import { GasAccountScreen } from '../GasAccount';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';
import MultiAddressHistory from '../Transaction/MultiAddressHistory';
import { GnosisQueueScreen } from '../GnosisQueue';
import { BatchRevokeScreen } from '../BatchRevoke/BatchRevoke';
import { useTranslation } from 'react-i18next';
import { PerpsOriginScreen } from '../Perps/index';
import { PerpsMarketDetailScreen } from '../PerpsMarketDetail';
import { PerpsHistoryScreen } from '../PerpsHistory';
import { PerpsSearchScreen } from '../PerpsSearch';
import LendingHistory from '../Lending/components/LendingHistory';
import LendingScreen from '../Lending';
import PredictionScreen from '../Prediction';
import { PredictionScreenWithPreload } from '../InnerDapp/InnerDappPreloadScreens';
import { useInnerDappPreloadStrategy } from '@/config/innerDappPreloadStrategy';
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';

const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

const CONVERT_DUST_HEADER_HEIGHT = 58;

function ConvertDustHeader({
  title,
  disableSwitch,
}: {
  title: string;
  disableSwitch?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle: getConvertDustHeaderStyle });
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.convertDustHeaderOuter, { marginTop: top }]}>
      <View style={styles.convertDustHeaderInner}>
        <View style={styles.convertDustHeaderLeft}>
          <HeaderBackPressable style={styles.convertDustHeaderBackButton} />
          <Text numberOfLines={1} style={styles.convertDustHeaderTitle}>
            {title}
          </Text>
        </View>
        <HeaderAccountSwitcher
          forScene="MakeTransactionAbout"
          disableSwitch={disableSwitch}
          style={styles.convertDustHeaderAccountSwitcher}
        />
      </View>
    </View>
  );
}

export default function TransactionNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  // console.log('============== TransactionNavigator Render =========');

  const { t } = useTranslation();
  const { colors, colors2024, isLight } = useTheme2024();
  const headerPresets = makeHeadersPresets({ colors, colors2024 });
  const innerDappStrategy = useInnerDappPreloadStrategy();

  const PredictionComponent =
    innerDappStrategy === 'screen'
      ? PredictionScreenWithPreload
      : PredictionScreen;

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
              : colors2024?.['neutral-bg-0'],
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
              : colors2024?.['neutral-bg-0'],
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
      {/* SwapBridgeScreen */}
      <TransactionStack.Screen
        name={RootNames.SwapBridge}
        component={SwapBridgeScreen}
        options={mergeScreenOptions2024([
          {
            title: '',
            headerTitle: () => null,
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.MultiSwapBridge}
        component={SwapBridgeScreen.ForMultipleAddress}
        options={mergeScreenOptions2024([
          {
            title: '',
            headerTitle: () => null,
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
        name={RootNames.ConvertDust}
        component={ConvertDustScreen}
        options={({ route }) =>
          mergeScreenOptions2024([
            {
              title: t('page.convertDust.title'),
              header: () => (
                <ConvertDustHeader
                  title={t('page.convertDust.title')}
                  disableSwitch={!!route.params?.disableAccountSwitch}
                />
              ),
            },
          ])
        }
      />

      <TransactionStack.Screen
        name={RootNames.GasAccount}
        component={GasAccountScreen}
        options={mergeScreenOptions({
          title: 'Gas Deposit',
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
        component={PerpsOriginScreen}
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
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.PerpsSearch}
        component={PerpsSearchScreen}
        options={mergeScreenOptions({
          headerShown: false,
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Lending}
        component={LendingScreen}
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
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            fontSize: 12,
            fontWeight: '900',
            fontFamily: 'SF Pro Rounded',
            color: colors['neutral-title-1'],
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.Prediction}
        component={PredictionComponent}
        options={mergeScreenOptions({
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          // headerShown: false,
          // gestureEnabled: true,
        })}
      />
    </TransactionStack.Navigator>
  );
}

const getConvertDustHeaderStyle = createGetStyles2024(({ colors2024 }) => ({
  convertDustHeaderOuter: {
    height: CONVERT_DUST_HEADER_HEIGHT,
    paddingHorizontal: 12,
    paddingRight: 20,
    paddingVertical: 10,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  convertDustHeaderInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  convertDustHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  convertDustHeaderBackButton: {
    marginLeft: 0,
    paddingLeft: 0,
  },
  convertDustHeaderTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  convertDustHeaderAccountSwitcher: {
    flexShrink: 1,
    minWidth: 0,
  },
}));
