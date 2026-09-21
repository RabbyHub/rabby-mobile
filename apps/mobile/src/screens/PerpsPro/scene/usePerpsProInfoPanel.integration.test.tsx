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
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import type { SpotMeta } from '@rabby-wallet/hyperliquid-sdk';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
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
import { formatPerpsProUsdValue } from '../utils/format';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));

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
const { usePerpsPortfolioBreakdown } =
  require('@/hooks/perps/usePerpsPortfolioBreakdown') as typeof import('@/hooks/perps/usePerpsPortfolioBreakdown');

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
let latest: ReturnType<typeof usePerpsProInfoPanel>;
let renderedValues: string[];
function AccountHarness({
  requested = null,
  active = true,
}: {
  requested?: PerpsProInfoTab | null;
  active?: boolean;
  revision?: number;
}) {
  const info = usePerpsProInfoPanel('BTC', requested, active);
  renderedValues.push(info.account.primaryValue);
  useLayoutEffect(() => {
    latest = info;
  });
  return (
    <PerpsProAccountValue
      testID="amount"
      style={amountStyle}
      value={formatPerpsProUsdValue(info.account.primaryValue)}
    />
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

  it.each(['ios', 'android'] as const)(
    'keeps the full value through swipe previews, cancellation and taps on %s',
    async os => {
      jest.replaceProperty(Platform, 'OS', os);
      const view = render(<AccountHarness />);
      await selectTab('account');
      measureAmount();
      const sourcePrices = perpsStore.getState().spotAssetCtxs;
      for (let revision = 1; revision <= 3; revision++) {
        await selectTab('openOrders');
        expectAmount('$173.25');
        // The native preview does not commit a preference or a requested tab.
        view.rerender(<AccountHarness revision={revision} />);
        expectAmount('$173.25');
        expect(latest.account.diagnostics.unpricedNonZeroAssets).toEqual([]);
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

  it('pauses price-only renders and catches up on the first reactivation render', async () => {
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

  it('reads full current prices during an unrelated render while notifications are paused', async () => {
    const view = render(<AccountHarness />);
    await selectTab('account');
    measureAmount();
    await selectTab('openOrders');
    updatePrice('32');
    const before = renderedValues.length;
    view.rerender(<AccountHarness revision={1} />);
    expect(renderedValues.slice(before)).toEqual(['181.25']);
    expectAmount('$181.25');
    act(() => perpsStore.setState({ spotState: spotState('60.25', '5') }));
    expectAmount('$220.25');
    expect(latest.account.diagnostics.unpricedNonZeroAssets).toEqual([]);
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
    expectAmount('$205.25');
    expect(latest.accountState).toBe('ready');
    expect(latest.account.diagnostics.unpricedNonZeroAssets).toEqual([]);
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
    expect(latest.account.primaryValue).toBe('233.25');
  });

  it('refreshes on Positions -> Account, pauses offscreen, and resumes on foreground', async () => {
    const view = render(<AccountHarness active={false} />);
    await selectTab('positions');
    await act(async () => view.rerender(<AccountHarness />));
    expect(stakingRequests()).toHaveLength(0);
    delegated = '2';
    await selectTab('account');
    expect(latest.account.primaryValue).toBe('233.25');
    expect(stakingRequests()).toHaveLength(1);

    delegated = '3';
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(latest.account.primaryValue).toBe('263.25');
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
    expect(latest.account.primaryValue).toBe('293.25');
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

  it('keeps a staking-only portfolio unresolved until HYPE is priced and exposes its breakdown', async () => {
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
    const breakdown = renderHook(() => usePerpsPortfolioBreakdown());
    expect(breakdown.result.current.hasNonPerpsAssets).toBe(true);
    act(() => perpsStore.setState({ stakingSummary: null }));
    expect(breakdown.result.current.hasNonPerpsAssets).toBe(false);
    expect(value.result.current).toBe(0);
  });
});
