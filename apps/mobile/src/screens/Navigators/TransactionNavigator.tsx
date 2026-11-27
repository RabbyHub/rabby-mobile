import { withScreenPropsInjection } from '@/devtools/screenRegistry/screenInjection';
import { RoundedFontStyles } from '@/core/utils/fonts';
import 'react-native-gesture-handler';
import React from 'react';
import { View } from 'react-native';
import { IS_IOS } from '@/core/native/utils';

import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { HeaderBackPressable, useStackScreenConfig } from '@/hooks/navigation';
import { useCustomHeaderTop } from '@/hooks/useAppLayout';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';
import {
  RootNames,
  makeHeadersPresets,
  makeTxPageBackgroundColors,
} from '@/constant/layout';
import { renderAppStackHeader } from '@/components/AppStackHeader';
import { useTheme2024 } from '@/hooks/theme';

import SendScreen from '../Send/Send';
import SendNFTScreen from '../SendNFT/SendNFT';

import { HistoryDetailScreen } from '../Transaction/HistoryDetailScreen';
import {
  BridgeDetailHeaderNode,
  BridgeDetailScreen,
} from '../Bridge/BridgeDetailScreen';
import { HistoryLocalDetailScreen } from '../Transaction/HistoryLocalDetailScreen';
import { HistoryDetailHeader } from '../Transaction/components/HistoryDetailHeader';
import { TransactionNavigatorParamList } from '@/navigation-type';
import ApprovalsScreen from '../Approvals';
import { ApprovalsHeader } from '../Approvals/components/Headers/ApprovalsHeader';
import ReceiveScreen, { ReceiveHeaderTitle } from '../Receive/Receive';
import SwapBridgeScreen from '../SwapBridge';
import { renderSwapBridgeHeader } from '../SwapBridge/SwapBridgeHeader';
import { ConvertDustScreen } from '../ConvertDust';
import { MemeCoinBuyScreen } from '../MemeCoin/buy/MemeCoinBuyScreen';
import { MemeCoinHeader } from '../MemeCoin/components/MemeCoinHeader';
import { MemeCoinExecuteScreen } from '../MemeCoin/execute/MemeCoinExecuteScreen';
import { MemeCoinHomeScreen } from '../MemeCoin/home/MemeCoinHomeScreen';
import { GasAccountScreen } from '../GasAccount';
import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';
import MultiAddressHistory from '../Transaction/MultiAddressHistory';
import { HistoryListHeaderTitle } from '../Transaction/components/HistoryListHeaderTitle';
import { HistoryFilterMenu } from '../Transaction/components/HistoryFilterMenu';
import { GnosisQueueScreen } from '../GnosisQueue';
import { BatchRevokeScreen } from '../BatchRevoke/BatchRevoke';
import { useTranslation } from 'react-i18next';
import { PerpsOriginScreen } from '../Perps/index';
import { PerpsMarketDetailScreen } from '../PerpsMarketDetail';
import { PerpsMarketDetailHeader } from '../PerpsMarketDetail/components/PerpsMarketDetailHeader';
import { PerpsHistoryScreen } from '../PerpsHistory';
import { PerpsProHistoryScreen } from '../PerpsProHistory';
import { PerpsProHistoryHeader } from '../PerpsProHistory/components/PerpsProHistoryHeader';
import { PerpsSearchScreen } from '../PerpsSearch';
import LendingHistory from '../Lending/components/LendingHistory';
import LendingScreen from '../Lending';
import { renderLendingHeader } from '../Lending/components/LendingHeaderTitle';
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';
import { withRegressionScenario } from '@/devtools/regressionScenarios/react';

const TransactionStack =
  createNativeStackNavigator<TransactionNavigatorParamList>();

const CONVERT_DUST_HEADER_HEIGHT = 58;
const RegressionSendScreen = withRegressionScenario(SendScreen, {
  screen: 'Send',
});
const RegressionMultiSendScreen = withRegressionScenario(
  SendScreen.ForMultipleAddress,
  {
    screen: 'Send',
  },
);
const RegressionSwapBridgeScreen = withRegressionScenario(SwapBridgeScreen, {
  screen: 'SwapBridge',
});
const RegressionReceiveScreen = withRegressionScenario(ReceiveScreen, {
  screen: 'Receive',
});
const RegressionMultiSwapBridgeScreen = withRegressionScenario(
  SwapBridgeScreen.ForMultipleAddress,
  {
    screen: 'SwapBridge',
  },
);

function ConvertDustHeader({
  title,
  disableSwitch,
}: {
  title: string;
  disableSwitch?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle: getConvertDustHeaderStyle });
  const headerTop = useCustomHeaderTop();
  const columnInset = useSystemColumnInset();

  return (
    <View
      style={[
        styles.convertDustHeaderOuter,
        {
          marginTop: headerTop,
          paddingLeft: 12 + columnInset.left,
          paddingRight: 20 + columnInset.right,
        },
      ]}>
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

  // The history screens (multi-address list and the single-address variant
  // share one component) declare their header on the route. Everything the
  // header reads comes from route params the screen publishes: the token
  // context, whether the filter switch applies, and the switch value. Nothing
  // swaps the header type after mount any more (QA 1384 / 1430).
  const renderHistoryRouteHeader = (
    route: { params?: TransactionNavigatorParamList['MultiAddressHistory'] },
    isForMultipleAddress: boolean,
    setShowAll: (value: boolean) => void,
  ) =>
    mergeScreenOptions({
      header: renderAppStackHeader(() => {
        const isShowAll = route.params?.isShowAll ?? false;
        return {
          title: 'Transactions',
          // The filter switch is wider than a back chevron; keep both slots at
          // the pre-migration 44pt so the title stays optically centred.
          sideSlotWidth: 44,
          titleNode: (
            <HistoryListHeaderTitle
              isForMultipleAddress={isForMultipleAddress}
              isInTokenDetail={route.params?.isInTokenDetail}
              tokenItem={route.params?.tokenItem}
            />
          ),
          right: route.params?.headerIsSupportAccount ? (
            <HistoryFilterMenu
              isShowAll={isShowAll}
              setIsShowAll={next =>
                setShowAll(typeof next === 'function' ? next(isShowAll) : next)
              }
            />
          ) : undefined,
        };
      }),
      headerBackVisible: false,
      headerLeft: () => null,
      unstable_headerLeftItems: () => [],
      headerStyle: {
        backgroundColor: makeTxPageBackgroundColors({ isLight, colors2024 }),
      },
    });

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
        component={withScreenPropsInjection(RegressionSendScreen)}
        options={mergeScreenOptions({
          title: 'Send',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            ...RoundedFontStyles.heavy,
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.MultiSend}
        component={withScreenPropsInjection(RegressionMultiSendScreen)}
        options={mergeScreenOptions({
          title: 'Send',
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            ...RoundedFontStyles.heavy,
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.SendNFT}
        component={withScreenPropsInjection(SendNFTScreen)}
        options={mergeScreenOptions({
          title: 'Send',
          unstable_headerRightItems: IS_IOS
            ? () => [{ type: 'spacing', spacing: 44 }]
            : undefined,
          headerTitleStyle: {
            color: colors2024['neutral-title-1'],
            ...RoundedFontStyles.heavy,
            fontSize: 20,
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.Receive}
        component={withScreenPropsInjection(RegressionReceiveScreen)}
        options={({ route, navigation }) =>
          mergeScreenOptions({
            // Route-level JS header: the account row + eye toggle come from
            // params the screen publishes, so the header type never changes.
            header: renderAppStackHeader(() => ({
              title: '',
              titleNode: (
                <ReceiveHeaderTitle
                  account={route.params?.account}
                  showName={route.params?.showName ?? true}
                  onToggleShowName={() =>
                    navigation.setParams({
                      showName: !(route.params?.showName ?? true),
                    })
                  }
                />
              ),
            })),
            headerBackVisible: false,
            headerLeft: () => null,
            unstable_headerLeftItems: () => [],
            headerTitleStyle: {
              color: colors2024['neutral-title-1'],
              ...RoundedFontStyles.heavy,
              fontSize: 20,
            },
          })
        }
      />
      <TransactionStack.Screen
        name={RootNames.MultiAddressHistory}
        component={withScreenPropsInjection(MultiAddressHistory)}
        options={({ route, navigation }) =>
          renderHistoryRouteHeader(route, true, isShowAll =>
            navigation?.setParams({ isShowAll }),
          )
        }
      />
      <TransactionStack.Screen
        name={RootNames.LendingHistory}
        component={withScreenPropsInjection(LendingHistory)}
        options={{
          title: 'Lending History',
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            ...RoundedFontStyles.heavy,
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
        component={withScreenPropsInjection(
          MultiAddressHistory.ForSingleAddress,
        )}
        options={({ route, navigation }) =>
          renderHistoryRouteHeader(route, false, isShowAll =>
            navigation?.setParams({ isShowAll }),
          )
        }
      />
      <TransactionStack.Screen
        name={RootNames.HistoryDetail}
        component={withScreenPropsInjection(HistoryDetailScreen)}
        options={({ route }) =>
          mergeScreenOptions({
            // Install the JS header on the route so the push transition starts
            // with the same header it ends with; swapping the header type after
            // mount made iOS animate the old native header out as a copy.
            header: () => (
              <HistoryDetailHeader
                title={route.params?.title}
                account={route.params?.account}
                address={route.params?.data?.address}
              />
            ),
            // The JS header draws its own back control.
            headerBackVisible: false,
            headerLeft: () => null,
            unstable_headerLeftItems: () => [],
          })
        }
      />
      <TransactionStack.Screen
        name={RootNames.BridgeDetail}
        component={withScreenPropsInjection(BridgeDetailScreen)}
        options={({ route }) =>
          mergeScreenOptions({
            // Route-level JS header: the title and the account row come from
            // params the screen publishes, so the type never changes on mount.
            header: renderAppStackHeader(() => ({
              title: '',
              titleNode: (
                <BridgeDetailHeaderNode
                  title={route.params?.headerTitle}
                  address={route.params?.address}
                  accountType={route.params?.headerAccountType}
                />
              ),
            })),
            headerBackVisible: false,
            headerLeft: () => null,
            unstable_headerLeftItems: () => [],
            headerTintColor: colors['neutral-title-1'],
            headerStyle: {
              backgroundColor: isLight
                ? colors2024['neutral-bg-0']
                : colors2024['neutral-bg-1'],
            },
          })
        }
      />
      <TransactionStack.Screen
        name={RootNames.HistoryLocalDetail}
        component={withScreenPropsInjection(HistoryLocalDetailScreen)}
        options={({ route }) =>
          mergeScreenOptions({
            // Same JS header as HistoryDetail: one header type for the whole
            // push transition, and it owns the back control.
            header: () => (
              <HistoryDetailHeader
                title={route.params?.title}
                account={route.params?.account}
                address={route.params?.data?.address}
                keyringType={route.params?.data?.keyringType}
              />
            ),
            headerBackVisible: false,
            headerLeft: () => null,
            unstable_headerLeftItems: () => [],
          })
        }
      />
      <TransactionStack.Screen
        name={RootNames.GnosisTransactionQueue}
        component={withScreenPropsInjection(GnosisQueueScreen)}
        options={({ route }) =>
          mergeScreenOptions({
            // Declared on the route; the screen publishes `headerTotal` via
            // setParams so the title stays current without a header swap.
            headerTitle: () =>
              t('page.safeQueue.title', {
                total: route.params?.headerTotal,
              }),
            title: 'Queue',
            ...headerPresets.withBgCard2,
          })
        }
      />
      {/* ReceiveScreen */}
      {/* SwapBridgeScreen */}
      <TransactionStack.Screen
        name={RootNames.SwapBridge}
        component={withScreenPropsInjection(RegressionSwapBridgeScreen)}
        options={mergeScreenOptions2024([
          {
            title: '',
            header: renderSwapBridgeHeader,
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.MultiSwapBridge}
        component={withScreenPropsInjection(RegressionMultiSwapBridgeScreen)}
        options={mergeScreenOptions2024([
          {
            title: '',
            header: renderSwapBridgeHeader,
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.Approvals}
        component={withScreenPropsInjection(ApprovalsScreen)}
        options={({ route }) =>
          mergeScreenOptions({
            title: t('page.approvals.title'),
            ...headerPresets.withBgCard2_2024,
            // Declarative header contract: the slots are fixed here instead of
            // being replaced from the screen's mount effect. The row draws its
            // own back button so the search field starts right after it
            // (QA 1328), and its search state lives in shared atoms.
            header: () => (
              <ApprovalsHeader
                account={
                  (route.params as { account?: any } | undefined)?.account
                }
              />
            ),
          })
        }
      />

      <TransactionStack.Screen
        name={RootNames.BatchRevoke}
        component={withScreenPropsInjection(BatchRevokeScreen)}
        options={mergeScreenOptions({
          title: t('page.batchRevoke.title'),
          ...headerPresets.withBgCard2_2024,
          headerStyle: {},
        })}
      />

      <TransactionStack.Screen
        name={RootNames.ConvertDust}
        component={withScreenPropsInjection(ConvertDustScreen)}
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
        name={RootNames.MemeCoin}
        component={withScreenPropsInjection(MemeCoinHomeScreen)}
        options={mergeScreenOptions2024([
          {
            title: t('page.home.services.meme'),
            header: () => <MemeCoinHeader />,
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.MemeCoinBuy}
        component={withScreenPropsInjection(MemeCoinBuyScreen)}
        options={mergeScreenOptions2024([
          {
            title: t('page.home.services.meme'),
            header: () => <MemeCoinHeader disableSwitch />,
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.MemeCoinExecute}
        component={withScreenPropsInjection(MemeCoinExecuteScreen)}
        options={mergeScreenOptions2024([
          {
            title: t('page.home.services.meme'),
            header: () => <MemeCoinHeader disableSwitch />,
          },
        ])}
      />

      <TransactionStack.Screen
        name={RootNames.GasAccount}
        component={withScreenPropsInjection(GasAccountScreen)}
        options={mergeScreenOptions({
          title: 'Gas Deposit',
          ...headerPresets.withBgCard2_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            ...RoundedFontStyles.heavy,
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: 'transparent',
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Perps}
        component={withScreenPropsInjection(PerpsOriginScreen)}
        options={mergeScreenOptions({
          headerShown: false,
          title: t('page.home.services.perps'),
          // ...headerPresets.withBgCard1_2024,
          // headerStyle: {
          //   backgroundColor: colors2024['neutral-bg-2'],
          // },
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            ...RoundedFontStyles.heavy,
            color: colors['neutral-title-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.PerpsMarketDetail}
        component={withScreenPropsInjection(PerpsMarketDetailScreen)}
        options={({ route }) =>
          mergeScreenOptions({
            title: '',
            header: () => (
              <PerpsMarketDetailHeader market={route.params.market} />
            ),
            // ...headerPresets.withBgCard1_2024,
            headerTintColor: colors['neutral-title-1'],
            headerTitleStyle: {
              fontSize: 20,
              ...RoundedFontStyles.heavy,
              color: colors['neutral-title-1'],
            },
          })
        }
      />

      <TransactionStack.Screen
        name={RootNames.PerpsHistory}
        component={withScreenPropsInjection(PerpsHistoryScreen)}
        options={mergeScreenOptions({
          title: t('page.perpsHistory.title'),
          // ...headerPresets.withBgCard1_2024,
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            fontSize: 20,
            ...RoundedFontStyles.heavy,
            color: colors['neutral-title-1'],
          },
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        })}
      />
      <TransactionStack.Screen
        name={RootNames.PerpsProHistory}
        component={withScreenPropsInjection(PerpsProHistoryScreen)}
        options={mergeScreenOptions({
          title: t('page.perps.pro.history.title'),
          header: () => (
            <PerpsProHistoryHeader title={t('page.perps.pro.history.title')} />
          ),
        })}
      />

      <TransactionStack.Screen
        name={RootNames.PerpsSearch}
        component={withScreenPropsInjection(PerpsSearchScreen)}
        options={mergeScreenOptions({
          headerShown: false,
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        })}
      />

      <TransactionStack.Screen
        name={RootNames.Lending}
        component={withScreenPropsInjection(LendingScreen)}
        options={mergeScreenOptions({
          title: '',
          ...headerPresets.withBgCard1_2024,
          header: renderLendingHeader,
          headerTintColor: colors['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: {
            fontSize: 12,
            ...RoundedFontStyles.heavy,
            color: colors['neutral-title-1'],
          },
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
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  convertDustHeaderAccountSwitcher: {
    flexShrink: 1,
    minWidth: 0,
  },
}));
