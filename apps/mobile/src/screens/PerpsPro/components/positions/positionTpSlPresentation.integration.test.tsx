import 'reflect-metadata';
import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalProvider } from '@gorhom/portal';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
// Instantiate the actual preference service at its storage boundary.
/* eslint-disable no-runtime-service-imports */
import { PerpsService } from '@/core/services/perpsService';
import { registerService } from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../../model/positionTpSl';

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    i18n: { language: 'en' },
    ready: true,
    t: (key: string) => key,
  }),
  Trans: ({ values }: any) =>
    require('react').createElement(
      require('react-native').Text,
      null,
      `${values?.pnl} ${values?.quoteAsset} ${values?.roi}`,
    ),
}));
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
// Native animation/gesture boundary: the test controls completion separately
// from the controller's settlement and the React layout event.
const mockNativeReactions: Array<{
  prepare: () => any;
  react: (value: any) => void;
}> = [];
const mockNativeSheetState = {
  animatedKeyboardState: { value: { status: 0 } },
  animatedAnimationState: { value: { status: 2 } },
  animatedScrollableStatus: { value: 1 },
  animatedPosition: { value: 94 },
  animatedSheetHeight: { value: 758 },
  animatedDetentsState: { value: { detents: [94] } },
};
jest.mock('react-native-reanimated', () => {
  const base = require('react-native-reanimated/mock');
  return {
    ...base,
    useSharedValue: (value: unknown) =>
      require('react').useRef({ value }).current,
    useAnimatedReaction: (prepare: () => any, react: (value: any) => void) => {
      mockNativeReactions.push({ prepare, react });
    },
    runOnJS: (callback: unknown) => callback,
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    ...require('@gorhom/bottom-sheet/mock'),
    BottomSheetFooter: View,
    BottomSheetFooterContainer: ({ footerComponent }: any) =>
      ReactModule.createElement(footerComponent, {
        animatedFooterPosition: { value: 0 },
      }),
    KEYBOARD_STATUS: { SHOWN: 1 },
    ANIMATION_STATUS: { STOPPED: 2 },
    SCROLLABLE_STATUS: { UNLOCKED: 1 },
    useBottomSheetInternal: () => mockNativeSheetState,
    BottomSheetModal: ReactModule.forwardRef((props: any, ref: any) => {
      const [closing, setClosing] = ReactModule.useState(false);
      const portalName = ReactModule.useId();
      if (!props.enableDynamicSizing)
        mockNativeSheetState.animatedSheetHeight.value = props.snapPoints[0];
      ReactModule.useImperativeHandle(ref, () => ({
        present: () => setClosing(false),
        close: () => setClosing(true),
        dismiss: () => setClosing(true),
        snapToIndex: () => undefined,
      }));
      return ReactModule.createElement(
        require('@gorhom/portal').Portal,
        { name: portalName },
        ReactModule.createElement(
          props.containerComponent || ReactModule.Fragment,
          null,
          ReactModule.createElement(
            View,
            {
              ...props,
              closing,
              testID: props.enableDynamicSizing
                ? typeof props.enablePanDownToClose === 'boolean'
                  ? 'native-confirmation-sheet'
                  : 'native-other-sheet'
                : 'native-main-sheet',
            },
            props.children,
            props.footerComponent
              ? ReactModule.createElement(props.footerComponent, {
                  animatedFooterPosition: { value: 0 },
                })
              : null,
          ),
        ),
      );
    }),
    BottomSheetScrollView: ReactModule.forwardRef(
      ({ children, ...props }: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          scrollTo: () => undefined,
          scrollToEnd: () => undefined,
        }));
        return ReactModule.createElement(View, props, children);
      },
    ),
  };
});
jest.mock('@rneui/themed', () => ({
  ...jest.requireActual('@rneui/themed'),
  Slider: require('react-native').View,
}));

// Production form, preference controller, input derivation and decimal buffer
// all run together. Only native and external SDK boundaries are replaced; no signing is invoked.
jest.mock('react-native-size-matters', () => ({
  moderateScale: (size: number) => size,
}));
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
// The app imports these native-sheet internals from untranspiled source.
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
const { perpsStore } =
  require('@/hooks/perps/usePerpsStore') as typeof import('@/hooks/perps/usePerpsStore');
const initialMarketDataMap = perpsStore.getState().marketDataMap;
const { PerpsProPositionTpSlSheet } =
  require('./PerpsProPositionTpSlSheet') as typeof import('./PerpsProPositionTpSlSheet');
const { PerpsProPositionTpSlSheets } =
  require('./PerpsProPositionTpSlSheets') as typeof import('./PerpsProPositionTpSlSheets');
const { usePerpsProPositionTpSlForm } =
  require('./PerpsProPositionTpSlForm') as typeof import('./PerpsProPositionTpSlForm');

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    <PortalProvider>{children}</PortalProvider>
  </SafeAreaProvider>
);
const PerpsProPositionTpSlForm = (
  props: Parameters<typeof usePerpsProPositionTpSlForm>[0],
) => {
  const { content, footer } = usePerpsProPositionTpSlForm(props);
  return (
    <>
      {content}
      {footer}
    </>
  );
};

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '120',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: null,
  szDecimals: 3,
};
const position: PerpsPositionViewModel = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '100',
  key: 'BTC',
  leverage: 10,
  liquidationPrice: '80',
  margin: '10',
  marginMode: 'cross',
  marginRatio: null,
  maxLeverage: 50,
  pnl: '20',
  quoteSize: '120',
  roiRatio: '2',
  tpslOrders: [],
};
const order = (
  scope: 'partial' | 'position',
): PerpsPositionTpSlOrderViewModel => ({
  execution: 'market',
  key: `${scope}:7`,
  kind: 'stopLoss',
  oid: 7,
  originalSize: scope === 'partial' ? '0.5' : '0',
  remainingSize: scope === 'partial' ? '0.5' : '0',
  scope,
  side: 'A',
  timestamp: 1,
  triggerPrice: '110',
});
const modeId = 'perps-pro-position-tpsl-stopLoss-mode-input';
const priceId = 'perps-pro-position-tpsl-stopLoss-price';

describe('position TP/SL input source integration', () => {
  let unregister: () => void;
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
      throw new Error('No signing in presentation tests');
    };
    unregister = registerService(
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
    perpsStore.setState({
      marketDataMap: {
        BTC: {
          index: 0,
          logoUrl: '',
          name: 'BTC',
          displayName: 'BTC',
          quoteAsset: 'USDC',
          maxLeverage: 50,
          minLeverage: 1,
          maxUsdValueSize: '1000000',
          maintenanceMarginTiers: [],
          szDecimals: market.szDecimals,
          pxDecimals: market.pxDecimals,
          dayBaseVlm: '0',
          dayNtlVlm: '0',
          funding: '0',
          markPx: market.markPrice,
          midPx: market.markPrice,
          openInterest: '0',
          oraclePx: market.markPrice,
          premium: '0',
          prevDayPx: '100',
          dexId: '',
        },
      },
    });
  });
  afterEach(async () => {
    await cleanupAsync();
    perpsStore.setState({ marketDataMap: initialMarketDataMap });
    jest.clearAllTimers();
  });
  afterAll(() => {
    unregister();
    jest.useRealTimers();
  });

  it.each([false, true])(
    'submits the live draft from a fixed footer with existing orders=%s and resets on page change',
    async hasOrders => {
      const onReview = jest.fn();
      const props: React.ComponentProps<typeof PerpsProPositionTpSlSheet> = {
        amountUnit: 'base',
        cancelingOids: [],
        confirmedCancelledOids: [],
        coveredByReview: false,
        defaultTab: 'partial',
        market,
        onCancelOrder: jest.fn(),
        onClose: jest.fn(),
        onReview,
        pending: false,
        position: {
          ...position,
          tpslOrders: hasOrders ? [order('partial')] : [],
        },
        visible: true,
      };
      const view = render(<PerpsProPositionTpSlSheet {...props} />, {
        wrapper,
      });
      await act(async () => {});
      const scroll = screen.getByTestId('perps-pro-position-tpsl-scroll');
      if (hasOrders) {
        fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
      }
      const footer = screen.getByTestId('perps-pro-position-tpsl-footer');
      expect(
        within(scroll).queryByTestId('perps-pro-position-tpsl-footer'),
      ).toBeNull();
      const triggerId = 'perps-pro-position-tpsl-takeProfit-price';
      const confirm = () =>
        screen.getByTestId('perps-pro-position-tpsl-review');
      fireEvent.press(confirm());
      act(() => jest.advanceTimersByTime(20));
      expect(onReview).not.toHaveBeenCalled();
      fireEvent.changeText(screen.getByTestId(triggerId), '130');
      fireEvent.changeText(
        screen.getByTestId('perps-pro-position-tpsl-amount'),
        '0.25',
      );
      expect(screen.getByTestId('perps-pro-position-tpsl-footer')).toBe(footer);
      expect(screen.getByTestId('perps-pro-position-tpsl-scroll')).toBe(scroll);
      fireEvent.press(confirm());
      act(() => jest.advanceTimersByTime(20));
      expect(onReview).toHaveBeenLastCalledWith({
        mode: 'add',
        scope: 'partial',
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: null,
            size: '0.25',
            triggerPrice: '130',
          },
        ],
      });

      // Review cancellation retains the draft, and the fixed button follows
      // the same lock/restoration contract as the fields.
      view.rerender(<PerpsProPositionTpSlSheet {...props} coveredByReview />);
      onReview.mockClear();
      fireEvent.press(confirm());
      act(() => jest.advanceTimersByTime(20));
      expect(onReview).not.toHaveBeenCalled();
      view.rerender(<PerpsProPositionTpSlSheet {...props} />);
      fireEvent(
        screen.getByTestId('perps-pro-position-tpsl-page-content'),
        'layout',
        {},
      );
      const observer = mockNativeReactions.at(-1)!;
      act(() => observer.react(observer.prepare()));
      expect(screen.getByTestId(triggerId).props.value).toBe('130');
      fireEvent.press(confirm());
      act(() => jest.advanceTimersByTime(20));
      expect(onReview.mock.lastCall?.[0].legs[0].size).toBe('0.25');

      if (hasOrders) {
        fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
        expect(
          screen.queryByTestId('perps-pro-position-tpsl-footer'),
        ).toBeNull();
        fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
      } else {
        fireEvent.press(
          screen.getByText('page.perps.pro.positions.positionTpsl'),
        );
        fireEvent.press(
          within(screen.getByTestId('perps-pro-position-tpsl-tabs')).getByText(
            'page.perps.pro.positions.tpsl',
          ),
        );
      }
      expect(screen.getByTestId('perps-pro-position-tpsl-scroll')).toBe(scroll);
      expect(screen.getByTestId(triggerId).props.value).toBe('');
      expect(
        screen.getByTestId('perps-pro-position-tpsl-slider-amount'),
      ).toHaveTextContent(/100%/);
      onReview.mockClear();
      fireEvent.press(confirm());
      act(() => jest.advanceTimersByTime(20));
      expect(onReview).not.toHaveBeenCalled();
    },
  );

  it('keeps the real editor locked until the closing confirmation and native restoration complete', async () => {
    const initial = order('partial');
    const props: React.ComponentProps<typeof PerpsProPositionTpSlSheets> = {
      amountUnit: 'base',
      cancelingOids: [],
      confirmedCancelledOids: [],
      defaultTab: 'partial',
      market,
      onCancelOrder: jest.fn(),
      onClose: jest.fn(),
      onCloseReview: jest.fn(),
      onReview: jest.fn(),
      onConfirm: jest.fn(),
      onToggleSkipConfirmation: jest.fn(),
      pending: false,
      position: { ...position, tpslOrders: [initial] },
      review: null,
      skipConfirmation: false,
      visible: true,
    };
    const view = render(<PerpsProPositionTpSlSheets {...props} />, { wrapper });
    await act(async () => {});
    const scroll = screen.getByTestId('perps-pro-position-tpsl-scroll');
    fireEvent.press(screen.getByText('page.perps.pro.positionTpsl.modify'));
    await act(async () => {});
    expect(
      screen.getByTestId('perps-pro-position-tpsl-form-subpage'),
    ).toBeTruthy();
    const frozen: NonNullable<typeof props.review> = {
      command: {
        accountAddress: '0x1',
        coin: 'BTC',
        direction: 'long',
        expectedPositionSize: '1',
        type: 'positionTpSl',
        scope: 'partial',
        markPrice: '120',
        legs: [
          { kind: 'stopLoss', replaceOid: 7, size: '0.5', triggerPrice: '108' },
        ],
      },
      draft: { mode: 'modify', scope: 'partial', legs: [] },
      markPrice: '120',
    };
    view.rerender(<PerpsProPositionTpSlSheets {...props} review={frozen} />);
    expect(scroll.props.scrollEnabled).toBe(false);
    const settlement = { revision: 1, scope: 'partial' as const };
    view.rerender(
      <PerpsProPositionTpSlSheets {...props} settlement={settlement} />,
    );
    expect(screen.getByTestId('native-confirmation-sheet').props.closing).toBe(
      true,
    );
    expect(
      screen.getByTestId('perps-pro-position-tpsl-form-subpage'),
    ).toBeTruthy();
    expect(screen.getByTestId('perps-pro-position-tpsl-scroll')).toBe(scroll);
    fireEvent(screen.getByTestId('native-confirmation-sheet'), 'dismiss');
    expect(screen.queryByTestId('native-confirmation-sheet')).toBeNull();
    expect(
      screen.queryByTestId('perps-pro-position-tpsl-form-subpage'),
    ).toBeNull();
    expect(screen.getByTestId('perps-pro-position-tpsl-add')).toBeTruthy();
    expect(scroll.props.scrollEnabled).toBe(false);
    fireEvent(
      screen.getByTestId('perps-pro-position-tpsl-page-content'),
      'layout',
      {},
    );
    const observer = mockNativeReactions.at(-1)!;
    mockNativeSheetState.animatedScrollableStatus.value = 0;
    act(() => observer.react(observer.prepare()));
    expect(scroll.props.scrollEnabled).toBe(false);
    mockNativeSheetState.animatedScrollableStatus.value = 1;
    mockNativeSheetState.animatedAnimationState.value.status = 1;
    act(() => observer.react(observer.prepare()));
    expect(scroll.props.scrollEnabled).toBe(false);
    mockNativeSheetState.animatedAnimationState.value.status = 2;
    mockNativeSheetState.animatedPosition.value = 93;
    act(() => observer.react(observer.prepare()));
    expect(scroll.props.scrollEnabled).toBe(false);
    mockNativeSheetState.animatedPosition.value = 94;
    act(() => observer.react(observer.prepare()));
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(screen.getByTestId('perps-pro-position-tpsl-scroll')).toBe(scroll);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('reopens a 0.01 PnL order without truncation or a focus/blur price rewrite', async () => {
    const initial = {
      ...order('partial'),
      kind: 'takeProfit' as const,
      triggerPrice: '86247',
      originalSize: '0.00014',
      remainingSize: '0.00014',
    };
    const onReview = jest.fn();
    render(
      <PerpsProPositionTpSlForm
        amountUnit="base"
        cancelingOids={[]}
        initialOrder={initial}
        markPrice="86008"
        market={{ ...market, szDecimals: 5, pxDecimals: 0 }}
        mode="modify"
        presentation="subpage"
        onCancelOrder={jest.fn()}
        onReview={onReview}
        pending={false}
        position={{
          ...position,
          entryPrice: '86176',
          baseSize: '0.00014',
          leverage: 22,
          tpslOrders: [initial],
        }}
      />,
      { wrapper },
    );
    await act(async () => {});
    const pnlId = 'perps-pro-position-tpsl-takeProfit-mode-input';
    const triggerId = 'perps-pro-position-tpsl-takeProfit-price';
    expect(screen.getByTestId(`${pnlId}-formatted-value`)).toHaveTextContent(
      '0.01',
    );
    expect(screen.getByText(/\+0.01/)).toBeTruthy();
    fireEvent(screen.getByTestId(pnlId), 'focus');
    fireEvent(screen.getByTestId(pnlId), 'blur');
    expect(screen.getByTestId(triggerId).props.value).toBe('86247');
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    act(() => jest.advanceTimersByTime(20));
    expect(onReview).not.toHaveBeenCalled();
    // Raw mode input is a target; its protocol-normalized price remains canonical.
    fireEvent.changeText(screen.getByTestId(pnlId), '0.02');
    expect(screen.getByTestId(pnlId).props.value).toBe('0.02');
    expect(screen.getByTestId(triggerId).props.value).toBe('86318');
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    act(() => jest.advanceTimersByTime(20));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        legs: [
          expect.objectContaining({
            triggerPrice: '86318',
            replaceOid: 7,
            size: '0.00014',
          }),
        ],
      }),
    );
  });

  it.each(['partial', 'position'] as const)(
    'keeps profitable %s SL unchanged on focus, then submits loss-side direct PNL with the original OID',
    async scope => {
      const initial = order(scope);
      const onReview = jest.fn();
      render(
        <PerpsProPositionTpSlForm
          amountUnit="base"
          cancelingOids={[]}
          initialOrder={scope === 'partial' ? initial : null}
          markPrice="120"
          market={market}
          mode={scope === 'partial' ? 'modify' : 'position'}
          presentation={scope === 'partial' ? 'subpage' : 'position-modify'}
          onCancelOrder={jest.fn()}
          onReview={onReview}
          pending={false}
          position={{ ...position, tpslOrders: [initial] }}
        />,
        { wrapper },
      );
      await act(async () => {});
      expect(screen.getByTestId(`${modeId}-formatted-value`)).toHaveTextContent(
        scope === 'partial' ? '5' : '10',
      );
      fireEvent(screen.getByTestId(modeId), 'focus');
      expect(screen.queryByTestId(`${modeId}-negative-prefix`)).toBeNull();
      fireEvent(screen.getByTestId(modeId), 'blur');
      expect(screen.getByTestId(priceId).props.value).toBe('110');
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
      act(() => jest.advanceTimersByTime(20));
      expect(onReview).not.toHaveBeenCalled();

      fireEvent(screen.getByTestId(modeId), 'focus');
      fireEvent.changeText(screen.getByTestId(modeId), '6');
      expect(screen.getByTestId(`${modeId}-negative-prefix`)).toHaveTextContent(
        '−',
      );
      expect(screen.getByTestId(priceId).props.value).toBe(
        scope === 'partial' ? '88' : '94',
      );
      fireEvent(screen.getByTestId(modeId), 'blur');
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
      act(() => jest.advanceTimersByTime(20));
      expect(onReview).toHaveBeenCalledWith(
        expect.objectContaining({
          scope,
          legs: [
            expect.objectContaining({
              kind: 'stopLoss',
              replaceOid: 7,
              triggerPrice: scope === 'partial' ? '88' : '94',
              size: scope === 'partial' ? '0.5' : null,
            }),
          ],
        }),
      );

      fireEvent.changeText(screen.getByTestId(priceId), '108');
      expect(screen.getByTestId(`${modeId}-formatted-value`)).toHaveTextContent(
        scope === 'partial' ? '4' : '8',
      );
      expect(
        screen.getByTestId(`${modeId}-formatted-value`),
      ).not.toHaveTextContent('−');
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
      act(() => jest.advanceTimersByTime(20));
      expect(onReview.mock.lastCall?.[0].legs[0]).toMatchObject({
        replaceOid: 7,
        triggerPrice: '108',
      });
    },
  );
});
