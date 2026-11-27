import { useCallback, useEffect, useMemo, useRef, type FC } from 'react';
import { StackActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { SvgProps } from 'react-native-svg';

import RcIconApprovalsCC from '@/assets2024/icons/home/IconApprovalsCC.svg';
import RcIconBridgeCC from '@/assets2024/icons/home/IconBridgeCC.svg';
import RcIconConvertDustCC from '@/assets2024/icons/home/IconDustCC.svg';
import RcIconGasAccountCC from '@/assets2024/icons/home/IconGasAccountCC.svg';
import RcIconHistoryCC from '@/assets2024/icons/home/IconHistoryCC.svg';
import RcIconLending from '@/assets2024/icons/home/IconLending.svg';
import RcIconMarketCC from '@/assets2024/icons/home/IconMarketCC.svg';
import RcIconMemeCoinCC from '@/assets2024/icons/home/IconMemeCoinCC.svg';
import RcIconPerps from '@/assets2024/icons/home/IconPerps.svg';
import RcIconPointsCC from '@/assets2024/icons/home/IconPointsCC.svg';
import RcIconReceiveCC from '@/assets2024/icons/home/IconReceiveCC.svg';
import RcIconSendCC from '@/assets2024/icons/home/IconSendCC.svg';
import RcIconSwapCC from '@/assets2024/icons/home/IconSwapCC.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { RootNames } from '@/constant/layout';
import { MultiHomeFeatTitle } from '@/constant/newStyle';
import {
  beginFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import { storeApiAccounts } from '@/hooks/account';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import { apisHomeTabIndex, useRabbyAppNavigation } from '@/hooks/navigation';
import { navigateToPerpsHome } from '@/hooks/perps/navigation/navigateToPreferredPerps';
import { useTheme2024 } from '@/hooks/theme';
import { preloadTransactionHotNavigator } from '@/perfs/preloads';
import { isTabsSwiping } from '@/screens/Address/components/MultiAssets/hooks';
import { clearLendingActionPopupState } from '@/screens/Lending/utils/actionPopup';
import type { Account } from '@/types/account';
import { navigateDeprecated } from '@/utils/navigation';
import { useDismissConvertDustBanner } from '../../hooks/useConvertDustBanner';

export type HomeFeatureItem = {
  key: MultiHomeFeatTitle;
  title: string;
  icon: FC<SvgProps>;
};

/** Title and icon of every feature card, keyed by feature. */
export function useHomeFeatureItems() {
  const { t } = useTranslation();

  return useMemo(() => {
    const items: HomeFeatureItem[] = [
      {
        key: MultiHomeFeatTitle.Swap,
        title: t('page.home.services.swap'),
        icon: RcIconSwapCC,
      },
      {
        key: MultiHomeFeatTitle.Bridge,
        title: t('page.home.services.bridge'),
        icon: RcIconBridgeCC,
      },
      {
        key: MultiHomeFeatTitle.Send,
        title: t('page.home.services.send'),
        icon: RcIconSendCC,
      },
      {
        key: MultiHomeFeatTitle.Receive,
        title: t('page.home.services.receive'),
        icon: RcIconReceiveCC,
      },
      {
        key: MultiHomeFeatTitle.Perps,
        title: t('page.home.services.perps'),
        icon: RcIconPerps,
      },
      {
        key: MultiHomeFeatTitle.MemeCoin,
        title: t('page.home.services.meme'),
        icon: RcIconMemeCoinCC,
      },
      {
        key: MultiHomeFeatTitle.GasAccount,
        title: t('page.home.services.gasDeposit'),
        icon: RcIconGasAccountCC,
      },
      {
        key: MultiHomeFeatTitle.History,
        title: t('page.home.services.history'),
        icon: RcIconHistoryCC,
      },
      {
        key: MultiHomeFeatTitle.Market,
        title: t('page.home.services.market'),
        icon: RcIconMarketCC,
      },
      {
        key: MultiHomeFeatTitle.Approvals,
        title: t('page.home.services.approvals'),
        icon: RcIconApprovalsCC,
      },
      {
        key: MultiHomeFeatTitle.Points,
        title: t('page.rabbyPoints.title'),
        icon: RcIconPointsCC,
      },
      {
        key: MultiHomeFeatTitle.ConvertDust,
        title: t('page.home.services.convertDust'),
        icon: RcIconConvertDustCC,
      },
      {
        key: MultiHomeFeatTitle.Lending,
        title: t('page.home.services.lending'),
        icon: RcIconLending,
      },
    ];

    return new Map(items.map(item => [item.key, item]));
  }, [t]);
}

/** Opens the feature behind a card. Shared by both floors of the Home. */
export function useHomeFeaturePress() {
  const navigation = useRabbyAppNavigation();
  const { isLight } = useTheme2024();
  const dismissConvertDustBanner = useDismissConvertDustBanner();
  const receiveSelectingRef = useRef(false);
  const receiveSelectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (receiveSelectingTimerRef.current) {
        clearTimeout(receiveSelectingTimerRef.current);
        receiveSelectingTimerRef.current = null;
      }
    };
  }, []);

  const handlePressMarket = useCallback(() => {
    navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
      screen: RootNames.Market,
      params: {},
    });
  }, [navigation]);

  const navigateToReceive = useCallback(
    async (account: Account) => {
      if (receiveSelectingRef.current) {
        return;
      }

      receiveSelectingRef.current = true;

      try {
        await preloadTransactionHotNavigator();
      } catch (error) {
        console.error('preloadTransactionHotNavigator::receive::error', error);
      }

      navigation.dispatch(
        StackActions.push(RootNames.StackTransaction, {
          screen: RootNames.Receive,
          params: {
            account,
          },
        }),
      );

      receiveSelectingTimerRef.current = setTimeout(() => {
        receiveSelectingRef.current = false;
        receiveSelectingTimerRef.current = null;
      }, 1000);
    },
    [navigation],
  );

  const handlePressReceive = useCallback(() => {
    const accounts = storeApiAccounts.getAccounts();

    if (accounts.length === 1) {
      navigateToReceive(accounts[0]);
      return;
    }

    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.RECEIVE_ADDRESS_LIST,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        rootViewType: 'View',
        linearGradientType: isLight ? 'bg0' : 'bg1',
      },
      onSelectAccount: account => {
        if (!account) {
          return;
        }
        removeGlobalBottomSheetModal2024(modalId);
        navigateToReceive(account);
      },
    });
  }, [isLight, navigateToReceive]);

  return useCallback(
    (key: MultiHomeFeatTitle) => {
      if (!apisHomeTabIndex.isHomeAtFirstTab()) {
        return;
      }
      if (isTabsSwiping.value) {
        return;
      }
      switch (key) {
        case MultiHomeFeatTitle.Send:
          {
            const cycleId = beginFeatureActivation(
              'send',
              'multi_home_send_press',
            );
            markFeatureActivation('send', 'context-ready', {
              cycleId,
              reason: 'multi_home_context_not_required',
            });
            markFeatureActivation('send', 'navigation-dispatched', {
              cycleId,
              reason: 'multi_home_navigation_push',
            });
          }
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.Send,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Receive:
          handlePressReceive();
          break;
        case MultiHomeFeatTitle.Swap:
          {
            const cycleId = beginFeatureActivation(
              'swap',
              'multi_home_swap_press',
            );
            markFeatureActivation('swap', 'navigation-dispatched', {
              cycleId,
              reason: 'multi_home_navigation_push',
            });
          }
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiSwapBridge,
              params: {
                activeTab: 'swap',
              },
            }),
          );

          break;
        case MultiHomeFeatTitle.Bridge:
          {
            const cycleId = beginFeatureActivation(
              'bridge',
              'multi_home_bridge_press',
            );
            markFeatureActivation('bridge', 'navigation-dispatched', {
              cycleId,
              reason: 'multi_home_navigation_push',
            });
          }
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiSwapBridge,
              params: {
                activeTab: 'bridge',
              },
            }),
          );
          break;
        case MultiHomeFeatTitle.History:
          storeApiAccountsSwitcher.toggleUseAllAccountsOnScene(
            'MultiHistory',
            true,
          );
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiAddressHistory,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Approvals:
          navigateDeprecated(RootNames.StackAddress, {
            screen: RootNames.ApprovalAddressList,
          });
          break;
        case MultiHomeFeatTitle.GasAccount:
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.GasAccount,
              params: {},
            }),
          );
          break;
        case MultiHomeFeatTitle.Market: {
          handlePressMarket();
          break;
        }
        case MultiHomeFeatTitle.Ecosystem:
          break;
        case MultiHomeFeatTitle.Perps:
          void navigateToPerpsHome({
            navigation,
            source: 'home-main',
          });
          break;
        case MultiHomeFeatTitle.Lending:
          clearLendingActionPopupState();
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Lending,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.Points:
          navigation.push(RootNames.StackAddress, {
            screen: RootNames.Points,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.ConvertDust:
          dismissConvertDustBanner();
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.ConvertDust,
            params: {},
          });
          break;
        case MultiHomeFeatTitle.MemeCoin:
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.MemeCoin,
          });
          break;
        default:
          break;
      }
    },
    [
      dismissConvertDustBanner,
      handlePressMarket,
      handlePressReceive,
      navigation,
    ],
  );
}
