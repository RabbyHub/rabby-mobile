import 'reflect-metadata';
import React, { useLayoutEffect } from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Slider } from '@rneui/themed';
import type { PerpsPositionViewModel } from '../../model/position';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('@rneui/themed', () => ({
  ...jest.requireActual('@rneui/themed'),
  Slider: require('react-native').View,
}));

// Keep import-time startup tasks dormant. The source Store, margin controller,
// formatter, slider adapter, amount row and decimal buffer remain real.
jest.mock('react-native-inappbrowser-reborn', () => ({ InAppBrowser: {} }));
jest.mock(
  'react-native-walkthrough-tooltip',
  () => require('react-native').View,
);
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
}));
jest.mock(
  '@safe-global/protocol-kit/dist/src/utils/eip-712',
  () => ({
    hashSafeMessage: () => {
      throw new Error('No Safe signing in presentation tests');
    },
  }),
  { virtual: true },
);
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { IOS: {}, ANDROID: {} },
  RESULTS: { GRANTED: 'granted' },
  checkMultiple: jest.fn(),
  requestMultiple: jest.fn(),
}));
jest.mock('@onekeyfe/hd-ble-sdk', () => ({}));
jest.useFakeTimers();
const { perpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const { usePerpsProManageMargin } =
  require('../../scene/usePerpsProManageMargin') as typeof import('../../scene/usePerpsProManageMargin');
const { PerpsProManageMarginAmountRow } =
  require('./PerpsProManageMarginAmountRow') as typeof import('./PerpsProManageMarginAmountRow');
const { PerpsProManageMarginSlider } =
  require('./PerpsProManageMarginSlider') as typeof import('./PerpsProManageMarginSlider');

const initialState = perpsStore.getState();
const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'Watch Address',
  brandName: 'Watch Address',
};
const position: PerpsPositionViewModel = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '95',
  key: 'BTC',
  leverage: 10,
  liquidationPrice: '80',
  margin: '20',
  marginMode: 'isolated',
  marginRatio: '0.1',
  maxLeverage: 20,
  pnl: '5',
  quoteSize: '100',
  roiRatio: '0.25',
  tpslOrders: [],
};
const rawPosition = (marginUsed: string) => ({
  type: 'oneWay',
  position: {
    coin: 'BTC',
    entryPx: '95',
    leverage: { type: 'isolated', value: 10 },
    liquidationPx: '80',
    marginUsed,
    szi: '1',
  },
});
let latest: ReturnType<typeof usePerpsProManageMargin>;
const Harness = () => {
  const controller = usePerpsProManageMargin();
  useLayoutEffect(() => {
    latest = controller;
  });
  return (
    <>
      <PerpsProManageMarginAmountRow
        draft={controller.draft}
        onBeginEditing={controller.beginEditing}
        onChangeDraft={controller.changeDraft}
        onSelectTarget={controller.selectTarget}
        pending={false}
        range={controller.view?.range ?? null}
      />
      <PerpsProManageMarginSlider
        maximum={controller.view?.range?.max ?? '25'}
        minimum={controller.view?.range?.min ?? '10.1'}
        onValueChange={controller.selectTarget}
        value={controller.draft}
      />
    </>
  );
};
const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    {children}
  </SafeAreaProvider>
);
const id = 'perps-pro-manage-margin-input';
const expectAmount = (value: string) => {
  expect(screen.getByTestId(id).props.value).toBe(value);
  expect(
    screen.getByTestId(`${id}-measure`, { includeHiddenElements: true }).props
      .children,
  ).toBe(value || '0');
  expect(latest.draft).toBe(value);
};
const updateMargin = (value: string) =>
  act(() =>
    perpsStore.setState(state => ({
      currentClearinghouseState: {
        ...state.currentClearinghouseState,
        assetPositions: [rawPosition(value)],
      } as typeof state.currentClearinghouseState,
    })),
  );

describe('margin target and real decimal buffer integration', () => {
  beforeEach(() => {
    perpsStore.setState({
      ...initialState,
      currentPerpsAccount: account,
      hasPermission: true,
      isUserDataReady: true,
      userAbstractionReady: true,
      userAbstractionOwnerAddress: account.address,
      currentClearinghouseState: {
        ...initialState.currentClearinghouseState,
        assetPositions: [rawPosition('20')],
        perDexSummaries: { '': { withdrawable: '5' } },
      } as typeof initialState.currentClearinghouseState,
      marketDataMap: {
        BTC: {
          name: 'BTC',
          displayName: 'BTC',
          dexId: '',
          markPx: '100',
          quoteAsset: 'USDC',
          pxDecimals: 2,
          marginMode: 'normal',
          onlyIsolated: false,
          maintenanceMarginTiers: [
            {
              lowerBound: '0',
              maintenanceDeduction: '0',
              maintenanceMarginRate: '0.05',
              maxLeverage: 20,
            },
          ],
        },
      } as typeof initialState.marketDataMap,
    });
  });
  afterEach(async () => {
    await cleanupAsync();
    perpsStore.setState(initialState, true);
    jest.clearAllTimers();
  });
  afterAll(() => jest.useRealTimers());

  it('preserves two decimals through initial/remote values, Min/Max and slider updates on one input host', () => {
    render(<Harness />, { wrapper });
    act(() => latest.open(position));
    expectAmount('20.00');
    const host = screen.getByTestId(id);
    updateMargin('21.1');
    expectAmount('21.10');
    fireEvent.press(screen.getByTestId('perps-pro-manage-margin-min'));
    expectAmount('10.10');
    fireEvent.press(screen.getByTestId('perps-pro-manage-margin-max'));
    expectAmount('26.10');
    const slider = screen
      .UNSAFE_getAllByType(Slider)
      .find(node => typeof node.props.onValueChange === 'function')!;
    for (const [value, text] of [
      [12.09, '12.09'],
      [12.1, '12.10'],
      [12.11, '12.11'],
      [12.99, '12.99'],
      [13, '13.00'],
    ] as const) {
      fireEvent(slider, 'valueChange', value);
      expectAmount(text);
      expect(screen.getByTestId(id)).toBe(host);
    }
    for (const node of [
      host,
      screen.getByTestId(`${id}-measure`, { includeHiddenElements: true }),
    ]) {
      expect(StyleSheet.flatten(node.props.style).fontVariant).toContain(
        'tabular-nums',
      );
    }
    updateMargin('22');
    expectAmount('13.00');
  });

  it('keeps raw typing and clears empty input, then canonicalizes only on blur', () => {
    render(<Harness />, { wrapper });
    act(() => latest.open(position));
    fireEvent(screen.getByTestId(id), 'focus');
    for (const value of ['1', '1.', '1.2', '12.2', '12.']) {
      fireEvent.changeText(screen.getByTestId(id), value);
      expectAmount(value);
    }
    fireEvent(screen.getByTestId(id), 'blur');
    expectAmount('12.00');
    fireEvent(screen.getByTestId(id), 'focus');
    fireEvent.changeText(screen.getByTestId(id), '1.2');
    fireEvent(screen.getByTestId(id), 'blur');
    expectAmount('1.20');
    fireEvent(screen.getByTestId(id), 'focus');
    fireEvent.changeText(screen.getByTestId(id), '');
    fireEvent(screen.getByTestId(id), 'blur');
    expectAmount('');
  });
});
