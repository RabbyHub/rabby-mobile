import React, { useLayoutEffect } from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native';
import { PixelRatio, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import type {
  AssetPosition,
  OpenOrder,
  SpotMeta,
} from '@rabby-wallet/hyperliquid-sdk';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
import type { AggregatedClearinghouseState } from '@/utils/perps';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
// Integration fixtures instantiate the real service at its storage boundary.
/* eslint-disable no-runtime-service-imports */
import { PerpsService } from '@/core/services/perpsService';
import { registerService } from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import {
  adoptExternalPerpsRuntime,
  getPerpsRuntimeIdentity,
  resetPerpsRuntimeStateForTests,
} from '@/hooks/perps/runtime/perpsRuntimeState';
import { PerpsProAccountValue } from '../components/account/PerpsProAccountValue';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import type { PerpsAccountViewModel } from '../model/account';
import { formatPerpsProUsdValue } from '../utils/format';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

// Keep import-time startup tasks dormant; only native/process boundaries are
// replaced. The source Store, preference service/controller, Hook, account
// pricing/formatting and amount component all run their production code.
jest.useFakeTimers();
const { perpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const { usePerpsProInfoPanel } =
  require('./usePerpsProInfoPanel') as typeof import('./usePerpsProInfoPanel');
const { usePerpsPortfolioLiveValue } =
  require('@/hooks/perps/usePerpsPortfolioLiveValue') as typeof import('@/hooks/perps/usePerpsPortfolioLiveValue');
const { PerpsProAccountSummaryRow, PerpsProAccountAssetDataRow } =
  require('./PerpsProAccountPresentation') as typeof import('./PerpsProAccountPresentation');
const { createPerpsProAccountSelectors } =
  require('./perpsProAccountSelectors') as typeof import('./perpsProAccountSelectors');

const initialState = perpsStore.getState();
const spotMeta: SpotMeta = {
  tokens: [
    { index: 0, name: 'USDC' },
    { index: 1, name: 'HYPE' },
  ],
  universe: [{ index: 10, name: 'HYPE/USDC', tokens: [1, 0] }],
};
const amountStyle = {
  fontFamily: 'SF Pro Rounded',
  fontWeight: '700' as const,
  fontVariant: ['tabular-nums' as const],
  fontSize: 18,
  lineHeight: 22,
};
const balance = (coin: string, token: number, total: string) => ({
  coin,
  token,
  total,
  hold: '0',
  entryNtl: '0',
  available: total,
});
const spotState = (usdc = '53.25', hype = '4') => {
  const rawBalances = [balance('USDC', 0, usdc), balance('HYPE', 1, hype)];
  return {
    ...initialState.spotState,
    rawBalances,
    rawBalancesByToken: Object.fromEntries(
      rawBalances.map(item => [item.token, item]),
    ),
  };
};
const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'Watch Address',
  brandName: 'Watch Address',
};
const positionFixture = (): AssetPosition => ({
  type: 'oneWay',
  position: {
    coin: 'BTC',
    cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
    entryPx: '50000',
    leverage: { type: 'cross', value: 10 },
    liquidationPx: '40000',
    marginUsed: '50',
    maxLeverage: 50,
    positionValue: '510',
    returnOnEquity: '0.2',
    szi: '0.01',
    unrealizedPnl: '10',
  },
});
const clearinghouseFixture = (): AggregatedClearinghouseState => ({
  assetPositions: [positionFixture()],
  crossMaintenanceMarginUsed: '10',
  crossMaintByDex: { '': '10' },
  crossMarginSummary: {
    accountValue: '100',
    totalMarginUsed: '50',
    totalNtlPos: '510',
    totalRawUsd: '90',
  },
  marginSummary: {
    accountValue: '100',
    totalMarginUsed: '50',
    totalNtlPos: '510',
    totalRawUsd: '90',
  },
  perDexSummaries: {},
  time: 1,
  withdrawable: '50',
});
const marketFixture = (): MarketData => ({
  name: 'other:BTC',
  displayName: 'BTC',
  dexId: 'other',
  index: 0,
  logoUrl: '',
  markPx: '100',
  midPx: '101',
  prevDayPx: '90',
  dayBaseVlm: '100',
  dayNtlVlm: '10000',
  funding: '0',
  openInterest: '10',
  oraclePx: '100',
  premium: '0',
  maxLeverage: 40,
  minLeverage: 1,
  maxUsdValueSize: '1000000',
  maintenanceMarginTiers: [],
  pxDecimals: 2,
  szDecimals: 3,
  onlyIsolated: false,
  quoteAsset: 'USDC',
});
const protectionOrderFixture = (): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: true,
  isTrigger: true,
  limitPx: '0',
  oid: 1,
  orderType: 'Take Profit Market',
  origSz: '0.01',
  reduceOnly: true,
  side: 'A',
  sz: '0.01',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Price above 60000',
  triggerPx: '60000',
});
let latest: ReturnType<typeof usePerpsProInfoPanel>;
let latestValuation: PerpsAccountViewModel;
let renderedValues: string[];
let rootRenders: number;
const AccountValuation = React.memo(function AccountValuation({
  selectors,
}: {
  selectors: ReturnType<typeof usePerpsProInfoPanel>['accountSelectors'];
  revision?: number;
}) {
  const accountValue = useActivityStore(perpsStore, selectors.valuation);
  renderedValues.push(accountValue.primaryValue);
  useLayoutEffect(() => {
    latestValuation = accountValue;
  });
  return (
    <PerpsProAccountValue
      testID="amount"
      style={amountStyle}
      value={formatPerpsProUsdValue(accountValue.primaryValue)}
    />
  );
});
function AccountHarness({
  requested = null,
  active = true,
  preview = false,
  revision = 0,
}: {
  requested?: PerpsProInfoTab | null;
  active?: boolean;
  preview?: boolean;
  revision?: number;
}) {
  const info = usePerpsProInfoPanel('BTC', requested, active);
  rootRenders++;
  useLayoutEffect(() => {
    latest = info;
  });
  return (
    <StoreActivityBoundary
      key={info.accountIdentity}
      label="perps-account-test"
      active={
        active && (preview || (requested ?? info.activeInfoTab) === 'account')
      }>
      <AccountValuation selectors={info.accountSelectors} revision={revision} />
    </StoreActivityBoundary>
  );
}
const measureAmount = (width = 75) => {
  fireEvent(screen.getByTestId('amount-slot'), 'layout', {
    nativeEvent: { layout: { width: 154, height: 22, x: 0, y: 0 } },
  });
  fireEvent(
    screen.getByTestId('amount-measure', { includeHiddenElements: true }),
    'textLayout',
    {
      nativeEvent: { lines: [{ width }] },
    },
  );
};
const expectAmount = (text: string, fontSize = 18) => {
  expect(screen.getByTestId('amount').props.children).toBe(text);
  expect(
    StyleSheet.flatten(screen.getByTestId('amount').props.style),
  ).toMatchObject({ opacity: 1, fontSize });
  expect(
    screen.queryByTestId('amount-measure', { includeHiddenElements: true }),
  ).toBeNull();
};
const selectTab = async (tab: PerpsProInfoTab) => {
  await act(async () => {
    await latest.setActiveInfoTab(tab);
  });
};
const updatePrice = (markPx: string, key = '@10') => {
  act(() =>
    perpsStore.setState(state => ({
      spotAssetCtxs: { ...state.spotAssetCtxs, [key]: { markPx } },
    })),
  );
};

describe('Perps Pro account price publication integration', () => {
  let unregisterService: () => void;
  let fetchSpy: jest.SpyInstance;
  let delegated: string;
  let stakingError: Error | null;
  const stakingRequests = () =>
    fetchSpy.mock.calls.filter(
      ([, init]) => JSON.parse(String(init?.body)).type === 'delegatorSummary',
    );
  beforeAll(() => {
    const values = new Map<string, unknown>();
    const storageAdapter: StorageAdapater = {
      getItem: key => values.get(String(key)) ?? null,
      setItem: (key, value) => {
        values.set(String(key), value);
      },
      removeItem: key => {
        values.delete(String(key));
      },
      clearAll: () => values.clear(),
    };
    const unavailableCrypto = async (): Promise<never> => {
      throw new Error('No signing in account presentation tests');
    };
    unregisterService = registerService(
      'perpsService',
      new PerpsService({
        storageAdapter,
        keyringCrypto: {
          isUnlocked: () => false,
          decryptWithPassword: unavailableCrypto,
          encryptWithPassword: unavailableCrypto,
        },
      }),
    );
  });
  beforeEach(() => {
    jest.clearAllTimers();
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
    delegated = '0';
    stakingError = null;
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        if (request.type === 'allPerpMetas') {
          return {
            ok: true,
            json: async () => [{ universe: [], marginTables: [] }],
          } as unknown as Response;
        }
        if (request.type !== 'delegatorSummary') {
          throw new Error(`Unexpected info request: ${request.type}`);
        }
        if (stakingError) {
          throw stakingError;
        }
        return {
          ok: true,
          json: async () => ({
            delegated,
            undelegated: '0',
            totalPendingWithdrawal: '0',
            nPendingWithdrawals: 0,
          }),
        } as Response;
      });
    renderedValues = [];
    rootRenders = 0;
    perpsStore.setState({
      ...initialState,
      currentPerpsAccount: account,
      isFetchAllDone: true,
      isUserDataReady: true,
      isSpotStateReady: true,
      isOpenOrdersReady: true,
      userAbstraction: UserAbstractionResp.unifiedAccount,
      userAbstractionReady: true,
      userAbstractionOwnerAddress: account.address,
      spotMeta,
      spotMetaStatus: 'success',
      spotState: spotState(),
      spotAssetCtxs: { '@10': { markPx: '30' } },
      stakingStatus: 'success',
      stakingSummary: {
        delegated: '0',
        undelegated: '0',
        totalPendingWithdrawal: '0',
      },
    });
    adoptExternalPerpsRuntime(getPerpsRuntimeIdentity(account));
  });
  afterEach(async () => {
    await cleanupAsync();
    perpsStore.setState(initialState, true);
    resetPerpsRuntimeStateForTests();
    jest.restoreAllMocks();
  });
  afterAll(() => {
    unregisterService();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps default selection based on authoritative positions, not valuation publications', async () => {
    const empty = render(<AccountHarness active={false} />);
    await act(async () => {});
    expect(latest.activeInfoTab).toBe('account');
    await empty.unmountAsync();

    const clearinghouse = clearinghouseFixture();
    perpsStore.setState({ currentClearinghouseState: clearinghouse });
    render(<AccountHarness active={false} />);
    expect(latest.activeInfoTab).toBe('positions');
    updatePrice('31');
    expect(latest.activeInfoTab).toBe('positions');
    act(() =>
      perpsStore.setState({
        currentClearinghouseState: { ...clearinghouse, assetPositions: [] },
      }),
    );
    expect(latest.activeInfoTab).toBe('positions');

    const nextAccount = {
      ...account,
      address: '0x0000000000000000000000000000000000000002',
    };
    act(() => {
      perpsStore.setState({
        currentPerpsAccount: nextAccount,
        userAbstractionOwnerAddress: nextAccount.address,
      });
      adoptExternalPerpsRuntime(getPerpsRuntimeIdentity(nextAccount));
    });
    expect(latest.activeInfoTab).toBe('account');
  });

  it('updates the production summary and asset leaves without publishing numeric prices to their root', async () => {
    const onDeposit = jest.fn();
    const onWithdraw = jest.fn();
    const onSwap = jest.fn();
    const onTransfer = jest.fn();
    function PresentationHarness() {
      const info = usePerpsProInfoPanel('BTC', null, false);
      rootRenders++;
      return (
        <StoreActivityBoundary active label="account-production-leaves">
          <PerpsProAccountSummaryRow
            selectors={info.accountSelectors}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
          />
          {info.accountAssetKeys.map(assetKey => (
            <PerpsProAccountAssetDataRow
              key={assetKey}
              assetKey={assetKey}
              selectors={info.accountSelectors}
              onSwap={onSwap}
              onTransfer={onTransfer}
            />
          ))}
        </StoreActivityBoundary>
      );
    }
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <PresentationHarness />
      </SafeAreaProvider>,
    );
    await act(async () => {});
    const before = rootRenders;
    expect(
      screen.getByTestId('perps-pro-account-portfolio-value').props.children,
    ).toBe('$173.25');
    expect(screen.getByTestId('perps-pro-asset-unified:0')).toBeOnTheScreen();

    updatePrice('31');
    expect(rootRenders).toBe(before);
    expect(
      screen.getByTestId('perps-pro-account-portfolio-value').props.children,
    ).toBe('$177.25');
    act(() => perpsStore.setState({ spotState: spotState('60.25', '5') }));
    expect(rootRenders).toBeGreaterThan(before);
    expect(screen.getByText('$60.25')).toBeOnTheScreen();
    expect(
      screen.getByTestId('perps-pro-account-portfolio-value').props.children,
    ).toBe('$215.25');
  });

  it('refreshes a zero-balance collateral row when its price becomes available without changing root readiness', () => {
    const rawBalances = [balance('USDT', 268, '0')];
    perpsStore.setState({
      spotState: {
        ...initialState.spotState,
        rawBalances,
        rawBalancesByToken: { 268: rawBalances[0] },
      },
      spotMeta: {
        tokens: [
          { index: 0, name: 'USDC' },
          { index: 268, name: 'USDT' },
        ],
        universe: [{ index: 166, name: 'USDT/USDC', tokens: [268, 0] }],
      },
      spotAssetCtxs: {},
    });
    const selectors = createPerpsProAccountSelectors();
    const source = perpsStore.getState();
    const control = selectors.control(source);
    const keys = selectors.assetKeys(source);
    expect(selectors.valuation(source).assets[0].usdValue).toBeNull();
    const priced = { ...source, spotAssetCtxs: { '@166': { markPx: '1' } } };
    expect(selectors.control(priced)).toBe(control);
    expect(selectors.assetKeys(priced)).toBe(keys);
    expect(selectors.valuation(priced).assets[0].usdValue).toBe('0');
    expect(selectors.valuation(source).assets[0].usdValue).toBeNull();
  });

  it('shares cached valuation across consumers and ignores unrelated ticker and market display changes', () => {
    const selectors = createPerpsProAccountSelectors();
    const market = marketFixture();
    const source = { ...perpsStore.getState(), marketData: [market] };
    const valuation = selectors.valuation(source);
    const summary = selectors.summary(source);
    const control = selectors.control(source);
    const keys = selectors.assetKeys(source);
    expect(selectors.valuation(source)).toBe(valuation);
    expect(summary.primaryValue).toBe(valuation.primaryValue);

    const unrelated = {
      ...source,
      marketData: [{ ...market, markPx: '999', displayName: 'Bitcoin' }],
      spotAssetCtxs: { ...source.spotAssetCtxs, '@999': { markPx: '1000' } },
      isOpenOrdersReady: false,
    };
    expect(selectors.valuation(unrelated)).toBe(valuation);
    expect(selectors.summary(unrelated)).toBe(summary);
    expect(selectors.control(unrelated)).toBe(control);
    expect(selectors.assetKeys(unrelated)).toBe(keys);

    const priced = {
      ...unrelated,
      spotAssetCtxs: { ...unrelated.spotAssetCtxs, '@10': { markPx: '31' } },
    };
    const nextValuation = selectors.valuation(priced);
    expect(nextValuation).not.toBe(valuation);
    expect(nextValuation.primaryValue).toBe('177.25');
    expect(selectors.control(priced)).toBe(control);
    expect(selectors.assetKeys(priced)).toBe(keys);
    expect(selectors.summary(priced)).toEqual({
      primaryValue: '177.25',
      unrealizedPnl: '0',
    });
    expect(selectors.valuation(priced)).toBe(nextValuation);

    const nextAccount = {
      ...priced,
      currentPerpsAccount: {
        ...account,
        address: '0x0000000000000000000000000000000000000002',
      },
      spotState: spotState('60.25', '5'),
    };
    expect(selectors.valuation(nextAccount).primaryValue).toBe('215.25');
    expect(selectors.summary(nextAccount).primaryValue).toBe('215.25');
    expect(selectors.valuation(source).primaryValue).toBe('173.25');
  });

  it('invalidates risk and valuation for market quote topology changes even when held spot prices stay unchanged', () => {
    const selectors = createPerpsProAccountSelectors();
    const source = {
      ...perpsStore.getState(),
      spotState: spotState('100', '4'),
      currentClearinghouseState: {
        ...clearinghouseFixture(),
        crossMaintByDex: { other: '10' },
      },
    };
    const unresolved = selectors.valuation(source);
    const summary = selectors.summary(source);
    expect(selectors.control(source)).toMatchObject({
      marginRatio: null,
      hasUnresolvedDexes: true,
    });
    const known = { ...source, marketData: [marketFixture()] };
    expect(selectors.control(known)).toMatchObject({
      marginRatio: '0.1',
      hasUnresolvedDexes: false,
    });
    const resolved = selectors.valuation(known);
    expect(resolved).not.toBe(unresolved);
    expect(resolved.diagnostics.unresolvedDexes).toEqual([]);
    expect(resolved.primaryValue).toBe(unresolved.primaryValue);
    expect(selectors.summary(known)).toBe(summary);

    const changedQuote = {
      ...known,
      marketData: [{ ...marketFixture(), quoteAsset: 'USDT' as const }],
    };
    expect(selectors.control(changedQuote).marginRatio).toBeNull();
    expect(selectors.valuation(changedQuote)).not.toBe(resolved);
    expect(selectors.control(known).marginRatio).toBe('0.1');
  });

  it('publishes missing and restored held prices to root readiness even while the Account leaf is inactive', async () => {
    render(<AccountHarness active={false} />);
    await selectTab('openOrders');
    expect(latest.accountState).toBe('ready');
    const before = rootRenders;
    act(() => perpsStore.setState({ spotAssetCtxs: {} }));
    expect(rootRenders).toBeGreaterThan(before);
    expect(latest.accountControl.hasUnpricedNonZeroAssets).toBe(true);
    expect(latest.accountState).toBe('loading');
    updatePrice('0');
    expect(latest.accountState).toBe('loading');
    updatePrice('32');
    expect(latest.accountControl.hasUnpricedNonZeroAssets).toBe(false);
    expect(latest.accountState).toBe('ready');
    const restored = rootRenders;
    updatePrice('33');
    expect(rootRenders).toBe(restored);
  });

  it('keeps funding value, readiness and pending count live outside the valuation activity boundary', async () => {
    render(<AccountHarness active={false} />);
    await selectTab('openOrders');
    act(() =>
      perpsStore.setState(state => ({
        spotState: { ...state.spotState, accountValue: '456' },
        localLoadingHistory: [
          {
            hash: 'pending-deposit',
            status: 'pending',
            time: 1,
            type: 'deposit',
            usdValue: '10',
          },
        ],
      })),
    );
    expect(latest.fundingAccountValue).toBe('456');
    expect(latest.fundingAccountValueReady).toBe(true);
    expect(latest.pendingFundingCount).toBe(1);
    act(() => perpsStore.setState({ isSpotStateReady: false }));
    expect(latest.fundingAccountValueReady).toBe(false);
    act(() =>
      perpsStore.setState({ isSpotStateReady: true, localLoadingHistory: [] }),
    );
    expect(latest.fundingAccountValueReady).toBe(true);
    expect(latest.pendingFundingCount).toBe(0);
  });

  describe('position projection publication', () => {
    let clearinghouse: AggregatedClearinghouseState;
    beforeEach(() => {
      clearinghouse = clearinghouseFixture();
      perpsStore.setState({
        currentClearinghouseState: clearinghouse,
        spotState: spotState('100', '4'),
      });
    });

    it('does not notify the root InfoPanel consumer for held-asset numeric price ticks', async () => {
      render(<AccountHarness active={false} />);
      await selectTab('positions');
      const before = latest;
      const rendersBefore = rootRenders;

      updatePrice('31');
      updatePrice('32');
      updatePrice('33');

      expect(rootRenders).toBe(rendersBefore);
      expect(latest).toBe(before);
      expect(perpsStore.getState().spotAssetCtxs['@10'].markPx).toBe('33');
    });

    it('keeps root and position identities stable while a preview catches up to spot valuation', async () => {
      const view = render(<AccountHarness active={false} />);
      await selectTab('positions');
      const before = latest;
      expect(latestValuation.primaryValue).toBe('220');
      expect(before.positions).toHaveLength(1);
      expect(before.positions[0].marginRatio).toBe('0.1');

      updatePrice('31');

      expect(latest).toBe(before);
      expect(latestValuation.primaryValue).toBe('220');
      view.rerender(<AccountHarness preview />);
      expect(latestValuation.primaryValue).toBe('224');
      expect(latest.positions).toBe(before.positions);
      expect(latest.positions[0]).toBe(before.positions[0]);
      expect(latest.allPositionsByCoin).toBe(before.allPositionsByCoin);
      expect(latest.allPositionsByCoin.get('BTC')).toBe(before.positions[0]);
      expect(perpsStore.getState().currentClearinghouseState).toBe(
        clearinghouse,
      );
    });

    it('publishes changed or unresolved risk even when raw positions and orders are unchanged', async () => {
      render(<AccountHarness active={false} />);
      await selectTab('account');
      const before = latest;
      expect(before.positions[0].marginRatio).toBe('0.1');
      act(() =>
        perpsStore.setState({
          currentClearinghouseState: {
            ...clearinghouse,
            crossMaintenanceMarginUsed: '20',
            crossMaintByDex: { '': '20' },
          },
        }),
      );
      expect(latestValuation.primaryValue).toBe('220');
      expect(latest.positions).not.toBe(before.positions);
      expect(latest.positions[0].marginRatio).toBe('0.2');
      expect(latest.allPositionsByCoin).not.toBe(before.allPositionsByCoin);
      expect(latest.allPositionsByCoin.get('BTC')).toBe(latest.positions[0]);
      expect(
        perpsStore.getState().currentClearinghouseState?.assetPositions,
      ).toBe(clearinghouse.assetPositions);

      act(() =>
        perpsStore.setState({
          currentClearinghouseState: {
            ...clearinghouse,
            crossMaintByDex: { 'unknown-dex': '20' },
          },
        }),
      );
      expect(latest.positions[0].marginRatio).toBeNull();
      expect(latest.allPositionsByCoin.get('BTC')?.marginRatio).toBeNull();
      expect(latest.accountState).toBe('error');

      act(() =>
        perpsStore.setState({ currentClearinghouseState: clearinghouse }),
      );
      expect(latest.positions[0].marginRatio).toBe('0.1');
      expect(latest.accountState).toBe('ready');
    });

    it('publishes raw position changes and removals even when the account risk is unchanged', async () => {
      render(<AccountHarness active={false} />);
      await selectTab('positions');
      const before = latest;
      const asset = clearinghouse.assetPositions[0];
      act(() =>
        perpsStore.setState({
          currentClearinghouseState: {
            ...clearinghouse,
            assetPositions: [
              {
                ...asset,
                position: {
                  ...asset.position,
                  szi: '0.02',
                  positionValue: '1020',
                  unrealizedPnl: '20',
                },
              },
            ],
          },
        }),
      );
      expect(latest.positions).not.toBe(before.positions);
      expect(latest.positions[0]).toMatchObject({
        baseSize: '0.02',
        quoteSize: '1020',
        pnl: '20',
        marginRatio: '0.1',
      });
      expect(latest.allPositionsByCoin.get('BTC')).toBe(latest.positions[0]);
      expect(
        latest.accountSelectors.valuation(perpsStore.getState()).unrealizedPnl,
      ).toBe('20');

      act(() =>
        perpsStore.setState({
          currentClearinghouseState: { ...clearinghouse, assetPositions: [] },
        }),
      );
      expect(latest.positions).toEqual([]);
      expect(latest.allPositionsByCoin.size).toBe(0);
      expect(latest.allPositionsCount).toBe(0);
      expect(latest.positionCollectionPresentation).toBe('authoritativeEmpty');
      expect(latest.activeInfoTab).toBe('positions');
    });

    it('publishes active protection-order additions, changes and removals without new position facts', async () => {
      render(<AccountHarness active={false} />);
      await selectTab('account');
      const before = latest;
      const order = protectionOrderFixture();
      act(() => perpsStore.setState({ openOrders: [order] }));
      expect(latest.accountControl).toBe(before.accountControl);
      expect(latest.positions).not.toBe(before.positions);
      expect(latest.positions[0].tpslOrders).toEqual([
        expect.objectContaining({ oid: 1, triggerPrice: '60000' }),
      ]);
      expect(latest.allPositionsByCoin.get('BTC')).toBe(latest.positions[0]);
      expect(latest.openOrderCounts.conditional).toBe(1);

      act(() =>
        perpsStore.setState({ openOrders: [{ ...order, triggerPx: '61000' }] }),
      );
      expect(latest.positions[0].tpslOrders[0].triggerPrice).toBe('61000');
      expect(
        latest.allPositionsByCoin.get('BTC')?.tpslOrders[0].triggerPrice,
      ).toBe('61000');

      act(() => perpsStore.setState({ openOrders: [] }));
      expect(latest.positions[0].tpslOrders).toEqual([]);
      expect(latest.allPositionsByCoin.get('BTC')?.tpslOrders).toEqual([]);
      expect(latest.positions[0].marginRatio).toBe('0.1');
      expect(latest.openOrderCounts.conditional).toBe(0);
      expect(perpsStore.getState().currentClearinghouseState).toBe(
        clearinghouse,
      );
    });
  });

  it.each(['ios', 'android'] as const)(
    'keeps the full value through retained tab snapshots and requested activation on %s',
    async os => {
      jest.replaceProperty(Platform, 'OS', os);
      const view = render(<AccountHarness />);
      await selectTab('account');
      measureAmount();
      const sourcePrices = perpsStore.getState().spotAssetCtxs;
      for (let revision = 1; revision <= 3; revision++) {
        await selectTab('openOrders');
        expectAmount('$173.25');
        // An unrelated retained-page render does not commit a tab preference.
        view.rerender(<AccountHarness revision={revision} />);
        expectAmount('$173.25');
        expect(latest.accountControl.hasUnpricedNonZeroAssets).toBe(false);
        await selectTab('account');
        expectAmount('$173.25');
      }
      await selectTab('openOrders');
      view.rerender(<AccountHarness requested="account" />);
      expectAmount('$173.25');
      view.rerender(<AccountHarness />);
      expectAmount('$173.25');
      await selectTab('positions');
      expectAmount('$173.25');
      expect(new Set(renderedValues)).toEqual(new Set(['173.25']));
      expect(perpsStore.getState().spotAssetCtxs).toBe(sourcePrices);
    },
  );

  it('pauses price-only renders and catches up once on the activation commit', async () => {
    render(<AccountHarness />);
    await selectTab('account');
    measureAmount();
    await selectTab('openOrders');
    const before = renderedValues.length;
    updatePrice('31');
    updatePrice('32');
    updatePrice('33');
    expect(renderedValues).toHaveLength(before);
    expectAmount('$173.25');
    await selectTab('account');
    expect(renderedValues.slice(before)).toEqual(['185.25']);
    expectAmount('$185.25');
    updatePrice('999', '@999');
    expect(renderedValues.slice(before)).toEqual(['185.25']);
    updatePrice('34');
    expectAmount('$189.25');
  });

  it('catches up when Account is previewed and pauses again when that preview is cancelled', async () => {
    const view = render(<AccountHarness />);
    await selectTab('openOrders');
    measureAmount();
    const before = renderedValues.length;
    const rootsBefore = rootRenders;
    updatePrice('31');
    updatePrice('32');
    expect(renderedValues).toHaveLength(before);
    expect(rootRenders).toBe(rootsBefore);
    expect(perpsStore.getState().spotAssetCtxs['@10'].markPx).toBe('32');

    view.rerender(<AccountHarness preview />);
    expect(renderedValues.slice(before)).toEqual(['181.25']);
    expectAmount('$181.25');
    expect(latest.activeInfoTab).toBe('openOrders');
    view.rerender(<AccountHarness />);
    const afterCancel = renderedValues.length;
    updatePrice('33');
    expect(renderedValues).toHaveLength(afterCancel);
    expectAmount('$181.25');
    expect(perpsStore.getState().spotAssetCtxs['@10'].markPx).toBe('33');
    view.rerender(<AccountHarness preview />);
    expect(renderedValues.slice(afterCancel)).toEqual(['185.25']);
    expectAmount('$185.25');
  });

  it('retains a complete inactive snapshot through unrelated renders and catches up on preview', async () => {
    const view = render(<AccountHarness />);
    await selectTab('account');
    measureAmount();
    await selectTab('openOrders');
    updatePrice('32');
    const before = renderedValues.length;
    view.rerender(<AccountHarness revision={1} />);
    expect(renderedValues.slice(before)).toEqual(['173.25']);
    expectAmount('$173.25');
    act(() => perpsStore.setState({ spotState: spotState('60.25', '5') }));
    expectAmount('$173.25');
    view.rerender(<AccountHarness preview revision={1} />);
    expectAmount('$220.25');
    expect(latest.accountControl.hasUnpricedNonZeroAssets).toBe(false);
  });

  it('reads the latest complete value on a paused remount and a requested-tab activation', async () => {
    const first = render(<AccountHarness />);
    await selectTab('openOrders');
    await first.unmountAsync();
    updatePrice('31');
    renderedValues = [];
    const second = render(<AccountHarness />);
    measureAmount();
    expectAmount('$177.25');
    updatePrice('32');
    expect(renderedValues).toEqual(['177.25']);
    second.rerender(<AccountHarness requested="account" />);
    expect(renderedValues).toEqual(['177.25', '181.25']);
    expectAmount('$181.25');
  });

  it('changes account and price dependencies without retaining the previous account value', async () => {
    render(<AccountHarness />);
    await selectTab('openOrders');
    measureAmount();
    const nextAccount = {
      ...account,
      address: '0x0000000000000000000000000000000000000002',
    };
    const nextSpotState = spotState('65.25', '4');
    nextSpotState.rawBalances[1] = balance('OTHER', 2, '7');
    nextSpotState.rawBalancesByToken = Object.fromEntries(
      nextSpotState.rawBalances.map(item => [item.token, item]),
    );
    const before = renderedValues.length;
    act(() => {
      perpsStore.setState({
        currentPerpsAccount: nextAccount,
        userAbstractionOwnerAddress: nextAccount.address,
        spotState: nextSpotState,
        spotMeta: {
          tokens: [...spotMeta.tokens, { index: 2, name: 'OTHER' }],
          universe: [
            ...spotMeta.universe,
            { index: 11, name: 'OTHER/USDC', tokens: [2, 0] },
          ],
        },
        spotAssetCtxs: { '@10': { markPx: '30' }, '@11': { markPx: '20' } },
      });
      adoptExternalPerpsRuntime(getPerpsRuntimeIdentity(nextAccount));
    });
    expect(renderedValues.slice(before)).toEqual(['205.25']);
    // Account identity replaces the retained page, including its text measure.
    measureAmount();
    expectAmount('$205.25');
    expect(latest.accountState).toBe('ready');
    expect(latest.accountControl.hasUnpricedNonZeroAssets).toBe(false);
    await selectTab('account');
    const afterActivation = renderedValues.length;
    updatePrice('999');
    expect(renderedValues).toHaveLength(afterActivation);
    updatePrice('21', '@11');
    expectAmount('$212.25');
  });

  it('preserves a verified large-amount font across tab changes', async () => {
    act(() =>
      perpsStore.setState({ spotState: spotState('194262049.75', '0') }),
    );
    render(<AccountHarness />);
    await selectTab('account');
    measureAmount(154.749);
    measureAmount(146.152);
    expectAmount('$194,262,049.75', 17);
    await selectTab('openOrders');
    expectAmount('$194,262,049.75', 17);
    await selectTab('account');
    expectAmount('$194,262,049.75', 17);
  });

  it('keeps an initial staking failure explicit and recovers when Account is reopened', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    perpsStore.setState({ stakingSummary: null, stakingStatus: 'idle' });
    const view = render(<AccountHarness active={false} />);
    await selectTab('account');
    expect(latest.accountState).toBe('loading');
    stakingError = new Error('offline');
    await act(async () => view.rerender(<AccountHarness />));
    expect(perpsStore.getState().stakingStatus).toBe('error');
    expect(latest.accountState).toBe('error');

    await selectTab('positions');
    stakingError = null;
    delegated = '2';
    await selectTab('account');
    expect(latest.accountState).toBe('ready');
    expect(latestValuation.primaryValue).toBe('233.25');
  });

  it('refreshes on Positions -> Account, pauses offscreen, and resumes on foreground', async () => {
    const view = render(<AccountHarness active={false} />);
    await selectTab('positions');
    await act(async () => view.rerender(<AccountHarness />));
    expect(stakingRequests()).toHaveLength(0);
    delegated = '2';
    await selectTab('account');
    expect(latestValuation.primaryValue).toBe('233.25');
    expect(stakingRequests()).toHaveLength(1);

    delegated = '3';
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(latestValuation.primaryValue).toBe('263.25');
    await selectTab('positions');
    const callsBeforePause = stakingRequests().length;
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(stakingRequests()).toHaveLength(callsBeforePause);

    await selectTab('account');
    view.rerender(<AccountHarness active={false} />);
    const callsBeforeBackground = stakingRequests().length;
    delegated = '4';
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(stakingRequests()).toHaveLength(callsBeforeBackground);
    await act(async () => view.rerender(<AccountHarness />));
    expect(latestValuation.primaryValue).toBe('293.25');
    expect(stakingRequests()).toHaveLength(callsBeforeBackground + 1);
    await view.unmountAsync();
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(stakingRequests()).toHaveLength(callsBeforeBackground + 1);
  });

  it('fetches once for a requested Account tab before the pager settles', async () => {
    const view = render(<AccountHarness active={false} />);
    await selectTab('positions');
    await act(async () =>
      view.rerender(<AccountHarness requested="account" />),
    );
    expect(stakingRequests()).toHaveLength(1);
    await selectTab('account');
    view.rerender(<AccountHarness />);
    expect(stakingRequests()).toHaveLength(1);
  });

  it('keeps a staking-only portfolio unresolved until HYPE is priced', async () => {
    perpsStore.setState({
      spotState: spotState('100', '0'),
      spotAssetCtxs: {},
      stakingSummary: {
        delegated: '5',
        undelegated: '0',
        totalPendingWithdrawal: '0',
      },
    });
    const value = renderHook(() => usePerpsPortfolioLiveValue());
    render(<AccountHarness active={false} />);
    expect(value.result.current).toBeNull();
    expect(latest.accountState).toBe('loading');
    updatePrice('40');
    expect(value.result.current).toBe(300);
    expect(latest.accountState).toBe('ready');
    act(() => perpsStore.setState({ spotState: spotState('0', '0') }));
    act(() => perpsStore.setState({ stakingSummary: null }));
    expect(value.result.current).toBe(0);
  });
});
