import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  accountHeaderQuote,
  createAccountHeaderPresentation,
  type AccountHeaderHandle,
} from './model';
import { View } from 'react-native';

jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'en', countryCode: 'US', isRTL: false }],
}));
jest.mock('react-native-inappbrowser-reborn', () => ({ InAppBrowser: {} }));
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
  useIsFocused: () => true,
}));
jest.mock('@rneui/themed', () => ({
  Text: require('react-native').Text,
  useThemeMode: () => ({ setMode: () => {} }),
  Slider: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'native-slider',
    }),
}));
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(),
  }),
}));
jest.mock(
  '@safe-global/protocol-kit/dist/src/utils/eip-712',
  () => ({
    hashSafeMessage: () => {
      throw new Error('No signing in UI tests');
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
jest.mock('react-native-size-matters', () => ({
  moderateScale: (size: number) => size,
}));
jest.mock(
  'react-native-walkthrough-tooltip',
  () => require('react-native').View,
);
jest.mock(
  '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/constants',
  () =>
    require('@gorhom/bottom-sheet/lib/commonjs/components/bottomSheetBackdrop/constants'),
);
jest.mock(
  '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/styles',
  () =>
    require('@gorhom/bottom-sheet/lib/commonjs/components/bottomSheetBackdrop/styles'),
);
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.useFakeTimers();
const { PerpsHeaderTitle } =
  require('../PerpsHeaderTitle') as typeof import('../PerpsHeaderTitle');
const { PerpsMarketDetailHeader } =
  require('../PerpsMarketDetailHeader') as typeof import('../PerpsMarketDetailHeader');
const { PerpsHeaderRight } =
  require('../PerpsHeaderRight') as typeof import('../PerpsHeaderRight');
const { PerpEditTpSlPriceTag } =
  require('../PerpEditTpSlPriceTag') as typeof import('../PerpEditTpSlPriceTag');
const { PerpsSlider } =
  require('../PerpsSlider') as typeof import('../PerpsSlider');
const { getVisibleBlockingModalIds, MODAL_GATE_IDS } =
  require('@/utils/modalGate') as typeof import('@/utils/modalGate');

const safe = (child: React.ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
    {child}
  </SafeAreaProvider>
);
afterEach(async () => {
  await cleanupAsync();
  jest.clearAllTimers();
});

it('keeps the initial navigator header mounted when the page attaches its latest presentation', () => {
  const ref = React.createRef<AccountHeaderHandle>();
  const presenter = createAccountHeaderPresentation(next =>
    ref.current?.update(next),
  );
  const attach = (header: AccountHeaderHandle | null) => {
    ref.current = header;
    header?.update(presenter.snapshot.current);
  };
  const ui = render(safe(<PerpsMarketDetailHeader market="ETH" />));
  const initialTitle = ui.UNSAFE_getByType(PerpsHeaderTitle);
  const initialCoin = ui.getByText('ETH/USDC');
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);

  // The page can publish before its ref is attached to the navigator's header.
  act(() => {
    presenter.quote(accountHeaderQuote(110, 100, 2), true);
    presenter.layout(62);
    presenter.scroll(70);
  });
  expect(ui.queryByText('$110.00')).toBeNull();
  const connectedHeader = (market: string) => (
    <PerpsMarketDetailHeader
      market={market}
      ref={attach}
      snapshotRef={presenter.snapshot}
    />
  );
  ui.rerender(safe(connectedHeader('ETH')));
  expect(ui.UNSAFE_getByType(PerpsHeaderTitle)).toBe(initialTitle);
  expect(ui.getByText('ETH/USDC')).toBe(initialCoin);
  expect(ui.getByText('$110.00')).toBeTruthy();
  expect(ui.getByText('+10.00%')).toBeTruthy();
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(0);

  act(() => presenter.quote(accountHeaderQuote(120, 100, 2), true));
  expect(ui.getByText('$120.00')).toBeTruthy();
  expect(ui.UNSAFE_getByType(PerpsHeaderTitle)).toBe(initialTitle);
  act(() => presenter.quote(accountHeaderQuote(130, 100, 2), false));
  expect(ui.getByText('$120.00')).toBeTruthy();
  act(() => presenter.quote(accountHeaderQuote(140, 100, 2), true));
  expect(ui.getByText('$140.00')).toBeTruthy();
  act(() => presenter.scroll(0));
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);

  act(() => presenter.scroll(70));
  act(() => presenter.reset());
  ui.rerender(safe(connectedHeader('BTC')));
  expect(ui.getByText('BTC/USDC')).toBeTruthy();
  expect(ui.queryByText('$140.00')).toBeNull();
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);
});

it('connects the real header to the page presenter and preserves coin selection/favorite restoration', async () => {
  const ref = React.createRef<AccountHeaderHandle>();
  const presenter = createAccountHeaderPresentation(next =>
    ref.current?.update(next),
  );
  const select = jest.fn();
  const ui = render(
    safe(
      <PerpsHeaderTitle
        ref={ref}
        snapshotRef={presenter.snapshot}
        coin="ETH"
        displayName="ETH"
        popupIsOpen={false}
        onSelectCoin={select}
      />,
    ),
  );
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);
  fireEvent.press(ui.getByText('ETH/USDC'));
  act(() => {
    presenter.quote(accountHeaderQuote(110, 100, 2), true);
    presenter.layout(62);
    presenter.scroll(70);
  });
  expect(ui.getByText('$110.00')).toBeTruthy();
  expect(ui.getByText('+10.00%')).toBeTruthy();
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(0);
  fireEvent.press(ui.getByText('ETH/USDC'));
  expect(select).toHaveBeenCalledTimes(2);
  // The arrow's native SVG boundary stays present in both states.
  expect(
    ui
      .UNSAFE_getAllByType(View)
      .filter(node => node.props.width === 18 && node.props.height === 18),
  ).toHaveLength(1);
  act(() => presenter.scroll(0));
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);
  expect(
    ui
      .UNSAFE_getAllByType(View)
      .filter(node => node.props.width === 18 && node.props.height === 18),
  ).toHaveLength(1);
});

it('uses the whole new price tag to cancel and preserves the default trigger presentation', async () => {
  const cancel = jest.fn(async () => {});
  const approve = jest.fn(async () => {});
  const props = {
    coin: 'ETH',
    entryPrice: 100,
    markPrice: 110,
    initTpOrSlPrice: '120',
    direction: 'Long' as const,
    size: 1,
    margin: 20,
    leverage: 5,
    liqPrice: 80,
    pxDecimals: 2,
    szDecimals: 3,
    actionType: 'tp' as const,
    quoteAsset: 'USDC',
    type: 'hasPosition' as const,
    handleSetAutoClose: jest.fn(async () => {}),
    handleCancelAutoClose: cancel,
    handleActionApproveStatus: approve,
  };
  const ui = render(
    safe(
      <PerpEditTpSlPriceTag {...props} variant="position" estimatedPnl={20} />,
    ),
  );
  await act(async () => fireEvent.press(ui.getByText('120 USDC')));
  await act(async () =>
    fireEvent.press(
      ui.getByText(/page.perpsDetail.simpleAccount.estimatedPnl/),
    ),
  );
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(approve).toHaveBeenCalledTimes(2);
  ui.rerender(safe(<PerpEditTpSlPriceTag {...props} />));
  expect(ui.getByText('$120')).toBeTruthy();
  expect(
    ui.queryByText(/page.perpsDetail.simpleAccount.estimatedPnl/),
  ).toBeNull();
  ui.rerender(
    safe(
      <PerpEditTpSlPriceTag {...props} initTpOrSlPrice="" variant="position" />,
    ),
  );
  await act(async () => fireEvent.press(ui.getByText('-')));
  expect(getVisibleBlockingModalIds()).toContain(
    MODAL_GATE_IDS.perpsEditTpSlPrice,
  );
  expect(cancel).toHaveBeenCalledTimes(2);
});

it('keeps default slider haptics isolated and gives close a haptic at each quarter', () => {
  const trigger = require('react-native-haptic-feedback').trigger;
  trigger.mockClear();
  const change = jest.fn();
  const ui = render(
    safe(<PerpsSlider value={0} onValueChange={change} step={1} />),
  );
  expect(ui.getByTestId('native-slider').props.minimumTrackTintColor).toBe(
    '#50D2C1',
  );
  act(() => {
    for (const value of [25, 50, 50, 75, 100]) {
      ui.getByTestId('native-slider').props.onValueChange(value);
    }
  });
  expect(trigger).toHaveBeenCalledTimes(2);
  trigger.mockClear();
  change.mockClear();
  ui.rerender(
    safe(
      <PerpsSlider variant="close" value={0} onValueChange={change} step={1} />,
    ),
  );
  const slider = ui.getByTestId('native-slider');
  expect(slider.props.step).toBe(1);
  act(() => {
    slider.props.onValueChange(25);
    slider.props.onValueChange(50);
    slider.props.onValueChange(50);
    slider.props.onValueChange(75);
    slider.props.onValueChange(100);
  });
  expect(change).toHaveBeenCalledTimes(5);
  expect(trigger).toHaveBeenCalledTimes(4);
});

it.each([
  {
    initial: 100,
    values: [100, 76, 75, 75, 74, 51, 49, 26, 24, 1, 0],
    pulses: [0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
  },
  {
    initial: 0,
    values: [0, 24, 26, 49, 51, 74, 76, 99, 100],
    pulses: [0, 0, 1, 0, 1, 0, 1, 0, 1],
  },
  { initial: 51, values: [49, 50, 51, 49, 50, 50], pulses: [1, 1, 0, 1, 1, 0] },
  { initial: 100, values: [1, 100], pulses: [1, 1] },
])(
  'detects close mark crossings without relying on exact callback values: $initial/$values',
  ({ initial, values, pulses }) => {
    const trigger = require('react-native-haptic-feedback').trigger;
    trigger.mockClear();
    const change = jest.fn();
    const ui = render(
      safe(
        <PerpsSlider
          variant="close"
          value={initial}
          onValueChange={change}
          step={1}
        />,
      ),
    );
    expect(trigger).not.toHaveBeenCalled();
    act(() => ui.getByTestId('native-slider').props.onSlidingStart(initial));
    values.forEach((value, i) => {
      const before = trigger.mock.calls.length;
      act(() => ui.getByTestId('native-slider').props.onValueChange(value));
      // A single native event emits at most one pulse, even across several marks.
      expect(trigger.mock.calls.length - before).toBe(pulses[i]);
    });
    expect(change.mock.calls.map(([value]) => value)).toEqual(values);
  },
);

it('handles track-tap ordering, controlled resets, and disabled close sliders', () => {
  const trigger = require('react-native-haptic-feedback').trigger;
  trigger.mockClear();
  const change = jest.fn();
  const start = jest.fn();
  const complete = jest.fn();
  const sliderProps = {
    variant: 'close' as const,
    onValueChange: change,
    onSlidingStart: start,
    onSlidingComplete: complete,
    step: 1,
  };
  const ui = render(safe(<PerpsSlider {...sliderProps} value={100} />));
  act(() => {
    const slider = ui.getByTestId('native-slider');
    slider.props.onValueChange(24);
    slider.props.onSlidingStart(24);
    slider.props.onValueChange(24);
    slider.props.onSlidingComplete(24);
  });
  expect(trigger).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  ui.rerender(safe(<PerpsSlider {...sliderProps} value={100} />));
  expect(trigger).toHaveBeenCalledTimes(1);
  act(() => ui.getByTestId('native-slider').props.onValueChange(100));
  expect(trigger).toHaveBeenCalledTimes(1);
  act(() => ui.getByTestId('native-slider').props.onSlidingComplete(100));
  ui.rerender(safe(<PerpsSlider {...sliderProps} value={51} />));
  act(() => ui.getByTestId('native-slider').props.onValueChange(49));
  expect(trigger).toHaveBeenCalledTimes(2);
  ui.rerender(safe(<PerpsSlider {...sliderProps} value={49} disabled />));
  const before = change.mock.calls.length;
  act(() => ui.getByTestId('native-slider').props.onValueChange(0));
  expect(trigger).toHaveBeenCalledTimes(2);
  expect(change).toHaveBeenCalledTimes(before);
});
