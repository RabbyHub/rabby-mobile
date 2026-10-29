import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { Platform, StyleSheet, View, type ListRenderItem } from 'react-native';
import { CollapsibleSceneProvider } from '@rabby-wallet/rn-collapsible-scene-view';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import type { StoreActivityScope } from '@/core/state/storeActivity';
import { RetainedScenePagerList } from '@/components/RetainedScenePagerList/RetainedScenePagerList';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';

const mockSetPage = jest.fn();
const mockJSQueue: Array<() => void> = [];
let mockDeferJS = false;

// Only native callbacks/clock execution are substituted. The pager reducer,
// SceneList, retained rows, scopes, source Store and Account leaves stay real.
jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react') as typeof React;
  const NativeView = require('react-native').View;
  return {
    __esModule: true,
    default: ReactModule.forwardRef(function NativePagerBoundary(
      props: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<unknown>,
    ) {
      ReactModule.useImperativeHandle(
        ref,
        () => ({ setPage: mockSetPage }),
        [],
      );
      return <NativeView {...props} />;
    }),
  };
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof React;
  const native = require('react-native');
  const boundary = require('react-native-reanimated/mock');
  return {
    ...boundary,
    __esModule: true,
    default: {
      ...boundary.default,
      createAnimatedComponent: (component: unknown) => component,
      View: native.View,
      ScrollView: native.ScrollView,
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const callback = (instance: unknown) => {
          callback.current = instance;
        };
        callback.current = null as unknown;
        return callback;
      }, []),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (current: unknown, previous: unknown) => void,
      dependencies: React.DependencyList = [],
    ) => {
      const previous = ReactModule.useRef<unknown>(null);
      ReactModule.useEffect(() => {
        const current = prepare();
        react(current, previous.current);
        previous.current = current;
      }, dependencies);
    },
    useAnimatedScrollHandler:
      (handlers: { onScroll: (event: unknown) => void }) =>
      (event: { nativeEvent: unknown }) =>
        handlers.onScroll(event.nativeEvent),
    useEvent: (handler: unknown) => handler,
    runOnUI: (callback: (...args: unknown[]) => void) => callback,
    runOnJS:
      (callback: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        if (mockDeferJS) {
          mockJSQueue.push(() => callback(...args));
        } else {
          callback(...args);
        }
      },
    scrollTo: jest.fn(),
  };
});

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

// Prevent import-time startup timers from running unrelated service/network
// work. None of the pager transitions below are driven by fake elapsed time.
jest.useFakeTimers();
const { perpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const { createPerpsProAccountSelectors } =
  require('./perpsProAccountSelectors') as typeof import('./perpsProAccountSelectors');
const { PerpsProAccountSummaryRow } =
  require('./PerpsProAccountPresentation') as typeof import('./PerpsProAccountPresentation');

const initialState = perpsStore.getState();
const keys = ['positions', 'openOrders', 'account'];
const hidden = { includeHiddenElements: true };
const data = Object.fromEntries(keys.map(key => [key, [{ key }]]));
const pageStyles = Object.fromEntries(
  keys.map(key => [key, { minHeight: 300 }]),
);
const noAction = () => {};
const pager = () => screen.getByTestId('account-pager-pager', hidden);
const accountPage = () =>
  screen.getByTestId('account-pager-page-account', hidden);
const amount = () =>
  screen.getByTestId('perps-pro-account-portfolio-value', hidden).props
    .children;
const measureAmount = () => {
  fireEvent(
    screen.getByTestId('perps-pro-account-portfolio-value-slot', hidden),
    'layout',
    { nativeEvent: { layout: { width: 154, height: 22, x: 0, y: 0 } } },
  );
  fireEvent(
    screen.getByTestId('perps-pro-account-portfolio-value-measure', hidden),
    'textLayout',
    { nativeEvent: { lines: [{ width: 75, height: 22, x: 0, y: 0 }] } },
  );
  expect(
    StyleSheet.flatten(
      screen.getByTestId('perps-pro-account-portfolio-value', hidden).props
        .style,
    ),
  ).toMatchObject({ opacity: 1 });
};
const pageState = (pageScrollState: 'dragging' | 'settling' | 'idle') =>
  fireEvent(pager(), 'pageScrollStateChanged', { pageScrollState });
const pageScroll = (position: number, offset: number) =>
  fireEvent(pager(), 'pageScroll', { position, offset });
const selected = (position: number) =>
  fireEvent(pager(), 'pageSelected', { position });
const updatePrice = (markPx: string) => {
  act(() =>
    perpsStore.setState(state => ({
      spotAssetCtxs: { ...state.spotAssetCtxs, '@10': { markPx } },
    })),
  );
};
const spotState = (usdc: string, hype: string) => {
  const rawBalances = [
    { coin: 'USDC', token: 0, total: usdc },
    { coin: 'HYPE', token: 1, total: hype },
  ].map(balance => ({
    ...balance,
    available: balance.total,
    hold: '0',
    entryNtl: '0',
  }));
  return {
    ...initialState.spotState,
    rawBalances,
    rawBalancesByToken: Object.fromEntries(
      rawBalances.map(row => [row.token, row]),
    ),
  };
};

function mountFixture() {
  const selectors = createPerpsProAccountSelectors();
  const committed = jest.fn();
  const settled = jest.fn();
  let accountScope: StoreActivityScope | null = null;

  function AccountRow() {
    accountScope = useStoreActivityScope();
    return (
      <React.Profiler id="account-summary" onRender={committed}>
        <PerpsProAccountSummaryRow
          selectors={selectors}
          onDeposit={noAction}
          onWithdraw={noAction}
        />
      </React.Profiler>
    );
  }
  const renderers: Record<string, ListRenderItem<{ key: string }>> = {
    positions: () => <View testID="positions-row" />,
    openOrders: () => <View testID="orders-row" />,
    account: () => <AccountRow />,
  };
  function Fixture({ identity = 'account-a' }: { identity?: string }) {
    const control = perpsStore(selectors.control);
    const [activeKey, setActiveKey] = React.useState('openOrders');
    const scrollOffset = useSharedValue(0);
    const indicatorPosition = useSharedValue(1);
    const gestureActive = useSharedValue(false);
    return (
      <CollapsibleSceneProvider
        activeTab={activeKey}
        tabs={keys}
        headerHeight={100}
        scrollOffset={scrollOffset}
        syncOffsetOnActivate={false}>
        <RetainedScenePagerList
          key={identity}
          activeKey={activeKey}
          keys={keys}
          identityKey={identity}
          activityEnabled
          dataByKey={data}
          renderItemByKey={renderers}
          pageStyleByKey={pageStyles}
          listHeader={
            <View testID="shared-trade" accessibilityLabel={control.mode} />
          }
          rowStartOffset={148}
          pinnedHeight={48}
          scrollOffset={scrollOffset}
          indicatorPosition={indicatorPosition}
          gestureActive={gestureActive}
          testID="account-pager"
          onTabChange={key => {
            settled(key);
            setActiveKey(key);
          }}
        />
      </CollapsibleSceneProvider>
    );
  }
  const result = render(<Fixture />, {
    wrapper: ({ children }) => (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        {children}
      </SafeAreaProvider>
    ),
  });
  return {
    ...result,
    committed,
    settled,
    scope: () => accountScope!,
    changeIdentity: (identity: string) =>
      result.rerender(<Fixture identity={identity} />),
  };
}

describe('retained Perps Account valuation lifecycle integration', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    mockSetPage.mockClear();
    mockJSQueue.length = 0;
    mockDeferJS = false;
    perpsStore.setState({
      ...initialState,
      userAbstraction: UserAbstractionResp.unifiedAccount,
      marketData: [],
      currentClearinghouseState: null,
      spotMeta: {
        tokens: [
          { index: 0, name: 'USDC' },
          { index: 1, name: 'HYPE' },
        ],
        universe: [{ index: 10, name: 'HYPE/USDC', tokens: [1, 0] }],
      },
      spotState: spotState('53.25', '4'),
      spotAssetCtxs: { '@10': { markPx: '30' } },
      stakingSummary: null,
    });
  });
  afterEach(async () => {
    await cleanupAsync();
    perpsStore.setState(initialState, true);
    mockJSQueue.length = 0;
    mockDeferJS = false;
    jest.restoreAllMocks();
  });
  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['ios', 'android'] as const)(
    'catches up only on native preview, pauses on cancel and resumes after selection on %s',
    os => {
      jest.replaceProperty(Platform, 'OS', os);
      const fixture = mountFixture();
      measureAmount();
      expect(amount()).toBe('$173.25');
      expect(fixture.scope().getActive()).toBe(false);
      const hiddenCommits = fixture.committed.mock.calls.length;
      updatePrice('31');
      updatePrice('32');
      expect(amount()).toBe('$173.25');
      expect(fixture.committed).toHaveBeenCalledTimes(hiddenCommits);
      expect(perpsStore.getState().spotAssetCtxs['@10'].markPx).toBe('32');
      expect(fixture.scope().getDiagnostics()).toMatchObject({
        stores: [
          expect.objectContaining({
            sourceSubscribed: false,
            publishedNotificationCount: 0,
          }),
        ],
      });

      pageState('dragging');
      expect(fixture.scope().getActive()).toBe(false);
      pageScroll(1, 0.25);
      expect(amount()).toBe('$181.25');
      expect(fixture.scope().getActive()).toBe(true);
      expect(fixture.scope().getDiagnostics()).toMatchObject({
        stores: [
          expect.objectContaining({ sourceSubscribed: true, catchUpCount: 1 }),
        ],
      });
      expect(fixture.settled).not.toHaveBeenCalled();
      expect(accountPage().props.pointerEvents).toBe('none');
      updatePrice('33');
      expect(amount()).toBe('$185.25');

      pageScroll(1, 0);
      pageState('idle');
      expect(fixture.scope().getActive()).toBe(false);
      expect(fixture.settled.mock.calls).toEqual([['openOrders']]);
      const cancelledCommits = fixture.committed.mock.calls.length;
      updatePrice('34');
      updatePrice('35');
      expect(amount()).toBe('$185.25');
      expect(fixture.committed).toHaveBeenCalledTimes(cancelledCommits);

      pageState('dragging');
      pageScroll(1, 0.6);
      expect(amount()).toBe('$193.25');
      pageState('settling');
      selected(2);
      pageState('idle');
      expect(fixture.settled).toHaveBeenLastCalledWith('account');
      expect(accountPage().props.pointerEvents).toBe('auto');
      expect(fixture.scope().getActive()).toBe(true);
      updatePrice('36');
      expect(amount()).toBe('$197.25');
      expect(fixture.scope().getDiagnostics()).toMatchObject({
        stores: [
          expect.objectContaining({ catchUpCount: 2, sourceSubscribed: true }),
        ],
      });
      expect(mockSetPage).not.toHaveBeenCalled();
    },
  );

  it.each(['ios', 'android'] as const)(
    'discards the previous account snapshot and queued native preview after identity remount on %s',
    os => {
      jest.replaceProperty(Platform, 'OS', os);
      const fixture = mountFixture();
      measureAmount();
      const oldScope = fixture.scope();
      mockDeferJS = true;
      pageState('dragging');
      pageScroll(1, 0.5);
      selected(2);
      pageState('idle');
      expect(mockJSQueue.length).toBeGreaterThan(0);

      act(() => {
        perpsStore.setState({
          currentPerpsAccount: {
            address: '0x0000000000000000000000000000000000000002',
            type: 'Watch Address',
            brandName: 'Watch Address',
          },
          spotState: spotState('200.25', '2'),
          spotAssetCtxs: { '@10': { markPx: '50' } },
        });
      });
      fixture.changeIdentity('account-b');
      expect(amount()).toBe('$300.25');
      measureAmount();
      expect(fixture.scope()).not.toBe(oldScope);
      expect(oldScope.getDiagnostics().stores).toEqual([]);
      expect(fixture.scope().getActive()).toBe(false);
      mockDeferJS = false;
      act(() => {
        while (mockJSQueue.length) {
          mockJSQueue.shift()?.();
        }
      });
      expect(fixture.settled).not.toHaveBeenCalled();
      expect(accountPage().props.pointerEvents).toBe('none');
      const hiddenCommits = fixture.committed.mock.calls.length;
      updatePrice('51');
      expect(amount()).toBe('$300.25');
      expect(fixture.committed).toHaveBeenCalledTimes(hiddenCommits);
      pageState('dragging');
      pageScroll(1, 0.25);
      expect(amount()).toBe('$302.25');
      selected(2);
      pageState('idle');
      expect(fixture.settled).toHaveBeenLastCalledWith('account');
      updatePrice('52');
      expect(amount()).toBe('$304.25');
    },
  );
});
