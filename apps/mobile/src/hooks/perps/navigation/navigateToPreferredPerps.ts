import { RootNames } from '@/constant/layout';
import type { Account } from '@/core/startupServices/preference';
import { switchPerpsAccountBeforeNavigate } from '@/hooks/perps/usePerpsStore';
import {
  preparePerpsViewMode,
  type PerpsViewModeSnapshot,
} from '@/hooks/perps/viewMode/perpsViewModeController';
import type {
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { prepareTransactionNavigatorForPerpsNavigation } from '@/perfs/preloads';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type PerpsNavigation = Pick<
  NativeStackNavigationProp<RootStackParamsList>,
  'push'
>;

type PerpsDetailParams =
  TransactionNavigatorParamList[typeof RootNames.PerpsMarketDetail];

export type PreferredPerpsNavigationRequest = {
  account?: Account;
  canonicalMarket?: string;
  marketCandidates?: readonly string[];
  navigation: PerpsNavigation;
  simpleDetail?: PerpsDetailParams;
  source: string;
};

type PreferredPerpsNavigationDependencies = {
  prepareNavigator: () => Promise<void>;
  prepareViewMode: () => Promise<PerpsViewModeSnapshot>;
  startHomeProIntent: () => void;
  startProIntent: (request: {
    accountAddress?: string;
    market?: string;
    marketCandidates?: readonly string[];
  }) => void;
  switchAccount: typeof switchPerpsAccountBeforeNavigate;
};

const defaultDependencies: PreferredPerpsNavigationDependencies = {
  prepareNavigator: prepareTransactionNavigatorForPerpsNavigation,
  prepareViewMode: preparePerpsViewMode,
  startHomeProIntent: () => {
    void import('@/startup/deferredTasks/perpsProAffinityWarmup')
      .then(({ startPerpsProHomeNavigationIntent }) =>
        startPerpsProHomeNavigationIntent(),
      )
      .catch(error => {
        console.error('[perpsProHomeIntent] start failed', error);
      });
  },
  startProIntent: request => {
    void import('@/startup/deferredTasks/perpsProAffinityWarmup')
      .then(({ startPerpsProExternalNavigationIntent }) =>
        startPerpsProExternalNavigationIntent(request),
      )
      .catch(error => {
        console.error('[perpsExternalNavigation] prewarm failed', error);
      });
  },
  switchAccount: switchPerpsAccountBeforeNavigate,
};

const preparePerpsRootNavigation = async (
  source: string,
  dependencies: PreferredPerpsNavigationDependencies,
) => {
  const [viewModeResult, navigatorResult] = await Promise.allSettled([
    dependencies.prepareViewMode(),
    dependencies.prepareNavigator(),
  ]);

  if (navigatorResult.status === 'rejected') {
    console.error(
      `[perpsNavigation] prepare navigator failed (${source})`,
      navigatorResult.reason,
    );
  }
  if (viewModeResult.status === 'rejected') {
    console.error(
      `[perpsNavigation] read mode failed (${source})`,
      viewModeResult.reason,
    );
    return 'simple' as const;
  }
  return viewModeResult.value.viewMode;
};

type PerpsHomeNavigationRequest = {
  navigation: PerpsNavigation;
  source: string;
};

const normalizeCandidates = (candidates?: readonly string[]) => {
  if (!candidates) {
    return undefined;
  }
  const normalized = Array.from(
    new Set(candidates.map(candidate => candidate.trim()).filter(Boolean)),
  );
  return normalized.length > 0 ? normalized : undefined;
};

export const runPreferredPerpsNavigation = async (
  request: PreferredPerpsNavigationRequest,
  dependencies: PreferredPerpsNavigationDependencies = defaultDependencies,
) => {
  const canonicalMarket = request.canonicalMarket?.trim() || undefined;
  const marketCandidates = normalizeCandidates(request.marketCandidates);

  try {
    if (request.account) {
      dependencies.switchAccount(request.account);
    }
  } catch (error) {
    console.error(
      `[perpsExternalNavigation] switch account failed (${request.source})`,
      error,
    );
    return false;
  }

  const viewMode = await preparePerpsRootNavigation(
    request.source,
    dependencies,
  );

  try {
    if (viewMode === 'pro') {
      try {
        dependencies.startProIntent({
          accountAddress: request.account?.address,
          market: canonicalMarket,
          marketCandidates,
        });
      } catch (error) {
        console.error(
          `[perpsExternalNavigation] prewarm failed (${request.source})`,
          error,
        );
      }
      request.navigation.push(RootNames.StackTransaction, {
        screen: RootNames.Perps,
        params: {
          account: request.account,
          dappId: 'hyperliquid',
          market: canonicalMarket,
          marketCandidates,
        },
      });
      return 'pro' as const;
    }

    request.navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Perps,
      params: {
        account: request.account,
        dappId: 'hyperliquid',
      },
    });
    if (request.simpleDetail) {
      request.navigation.push(RootNames.StackTransaction, {
        screen: RootNames.PerpsMarketDetail,
        params: request.simpleDetail,
      });
    }
    return 'simple' as const;
  } catch (error) {
    console.error(
      `[perpsExternalNavigation] navigation failed (${request.source})`,
      error,
    );
    return false;
  }
};

export const navigateToPreferredPerps = runPreferredPerpsNavigation;

export const runPerpsHomeNavigation = async (
  request: PerpsHomeNavigationRequest,
  dependencies: PreferredPerpsNavigationDependencies = defaultDependencies,
) => {
  const viewMode = await preparePerpsRootNavigation(
    request.source,
    dependencies,
  );

  try {
    if (viewMode === 'pro') {
      try {
        dependencies.startHomeProIntent();
      } catch (error) {
        console.error(
          `[perpsHomeNavigation] prewarm failed (${request.source})`,
          error,
        );
      }
    }
    request.navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Perps,
      params: {},
    });
    return viewMode;
  } catch (error) {
    console.error(
      `[perpsHomeNavigation] navigation failed (${request.source})`,
      error,
    );
    return false;
  }
};

export const navigateToPerpsHome = runPerpsHomeNavigation;
