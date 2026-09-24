import 'reflect-metadata';
import React from 'react';
import { Keyboard, UIManager } from 'react-native';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
// Instantiate the actual preference service at its storage boundary.
/* eslint-disable no-runtime-service-imports */
import { PerpsService } from '@/core/services/perpsService';
import { registerService } from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../../model/positionTpSl';
import { collectActivePositionTpSlOrders } from '../../model/positionTpSl';
import { buildPerpsOpenOrderTopology } from '../../model/openOrderTopology';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import type { PositionTpSlDependencies } from '@/hooks/perps/actions/positionTpSl';

jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
  __esModule: true,
  default: {
    ...require('react-native/jest/mocks/UIManager').default,
    measureInWindow: jest.fn(),
  },
}));
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
const mockNativeScrollToEnd = jest.fn();
const mockNativeSheetState = {
  animatedAnimationState: { value: { status: 2 } },
  animatedScrollableStatus: { value: 1 },
  animatedPosition: { value: 94 },
  animatedSheetHeight: { value: 758 },
  animatedDetentsState: { value: { detents: [94] } },
  animatedKeyboardState: { value: { status: 2 } },
  animatedLayoutState: { value: { handleHeight: 40 } },
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
    BottomSheetTextInput: ReactModule.forwardRef((props: any, ref: any) => {
      ReactModule.useImperativeHandle(ref, () => ({
        focus: jest.fn(),
        setNativeProps: jest.fn(),
        setSelection: jest.fn(),
      }));
      return ReactModule.createElement(
        require('react-native').TextInput,
        props,
      );
    }),
    ANIMATION_STATUS: { STOPPED: 2 },
    SCROLLABLE_STATUS: { UNLOCKED: 1 },
    KEYBOARD_STATUS: { HIDDEN: 2 },
    useBottomSheetInternal: () => mockNativeSheetState,
    BottomSheetModal: ReactModule.forwardRef((props: any, ref: any) => {
      const [closing, setClosing] = ReactModule.useState(false);
      if (!props.enableDynamicSizing)
        mockNativeSheetState.animatedSheetHeight.value = props.snapPoints[0];
      ReactModule.useImperativeHandle(ref, () => ({
        present: () => setClosing(false),
        close: () => setClosing(true),
        dismiss: () => setClosing(true),
        snapToIndex: () => undefined,
      }));
      return ReactModule.createElement(
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
      );
    }),
    BottomSheetScrollView: ReactModule.forwardRef(
      ({ children, ...props }: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          scrollTo: () => undefined,
          scrollToEnd: mockNativeScrollToEnd,
          getScrollableNode: () => 1001,
          getInnerViewNode: () => 1002,
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
const { buildPerpsPositionTpSlCommand, executePerpsPositionTpSl } =
  require('@/hooks/perps/actions/positionTpSl') as typeof import('@/hooks/perps/actions/positionTpSl');
const { PerpsProPositionTpSlSheets } =
  require('./PerpsProPositionTpSlSheets') as typeof import('./PerpsProPositionTpSlSheets');
const { PerpsProPositionTpSlForm } =
  require('./PerpsProPositionTpSlForm') as typeof import('./PerpsProPositionTpSlForm');
const { PerpsProPositionTpSlOrderList } =
  require('./PerpsProPositionTpSlOrderList') as typeof import('./PerpsProPositionTpSlOrderList');

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    {children}
  </SafeAreaProvider>
);
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
  beforeEach(() => jest.clearAllTimers());
  afterEach(async () => {
    await cleanupAsync();
    jest.clearAllTimers();
  });
  afterAll(() => {
    unregister();
    jest.useRealTimers();
  });

  it('preserves the submitted quantity and PnL through list, repeated Modify and a new PnL target', async () => {
    const precisionMarket = {
      ...market,
      markPrice: '84076',
      pxDecimals: 1,
      szDecimals: 5,
    };
    const precisionPosition = {
      ...position,
      baseSize: '0.00014',
      entryPrice: '83719',
      leverage: 37,
      liquidationPrice: '82540',
    };
    const account = {
      address: '0x0000000000000000000000000000000000000547',
      type: 'PrivateKey' as const,
    };
    let remoteOrders: OpenOrder[] = [];
    let nextOid = 7;
    const placements: Parameters<
      PositionTpSlDependencies['placePartial']
    >[0][] = [];
    const cancellations: number[] = [];
    const response = (statuses: unknown[]) => ({
      status: 'ok',
      response: { data: { statuses } },
    });
    // Stateful exchange boundary only: no signer or real SDK/network request.
    // Form, precision rules, command/executor, projection and list stay real.
    const exchange: PositionTpSlDependencies = {
      getCurrentAccount: () => account,
      getLiveMark: () => precisionMarket.markPrice,
      getLiveSignedSize: () => precisionPosition.baseSize,
      getLiveOpenOrders: () => remoteOrders,
      resolveDex: () => '',
      cancelOrder: async (_coin, oid) => {
        cancellations.push(oid);
        remoteOrders = remoteOrders.filter(item => item.oid !== oid);
        return response(['success']);
      },
      placePartial: async params => {
        placements.push(params);
        const oid = nextOid++;
        remoteOrders.push({
          coin: params.coin,
          isPositionTpsl: false,
          isTrigger: true,
          reduceOnly: params.reduceOnly,
          oid,
          orderType:
            params.tpsl === 'tp' ? 'Take Profit Market' : 'Stop Market',
          origSz: params.size,
          sz: params.size,
          limitPx: params.triggerPx,
          side: params.isBuy ? 'B' : 'A',
          tif: null,
          timestamp: oid,
          triggerCondition: '',
          triggerPx: params.triggerPx,
        });
        return response([{ resting: { oid } }]);
      },
      placePosition: async () => {
        throw new Error('Partial orders must not use position placement');
      },
      refresh: async () => undefined,
    };
    const onReview = jest.fn();
    const formProps = {
      amountUnit: 'quote' as const,
      cancelingOids: [],
      markPrice: precisionMarket.markPrice,
      market: precisionMarket,
      onCancelOrder: jest.fn(),
      onReview,
      pending: false,
      position: precisionPosition,
    };
    const executeDraft = async () => {
      const draft = onReview.mock.lastCall![0];
      const command = buildPerpsPositionTpSlCommand({
        account,
        coin: 'BTC',
        direction: 'long',
        expectedPositionSize: precisionPosition.baseSize,
        legs: draft.legs,
        markPrice: precisionMarket.markPrice,
        pxDecimals: precisionMarket.pxDecimals,
        scope: draft.scope,
        szDecimals: precisionMarket.szDecimals,
      });
      expect(command.legs[0].size).toBe('0.00007');
      expect((await executePerpsPositionTpSl(command, exchange)).kind).toBe(
        'success',
      );
      onReview.mockClear();
    };
    const readOrders = () =>
      collectActivePositionTpSlOrders(
        'BTC',
        'long',
        buildPerpsOpenOrderTopology(remoteOrders),
      );

    const add = render(<PerpsProPositionTpSlForm {...formProps} mode="add" />, {
      wrapper,
    });
    await act(async () => {});
    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-amount'),
      '5.89',
    );
    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input'),
      '33',
    );
    expect(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-hint'),
    ).toHaveTextContent(/\+33\.00/);
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    expect(onReview.mock.lastCall?.[0].legs[0]).toMatchObject({
      size: '0.00007',
      triggerPrice: '555140',
    });
    await executeDraft();
    add.unmount();

    for (let reopen = 0; reopen < 2; reopen += 1) {
      const orders = readOrders();
      const onModify = jest.fn();
      const list = render(
        <PerpsProPositionTpSlOrderList
          {...formProps}
          position={{ ...precisionPosition, tpslOrders: orders }}
          onAdd={jest.fn()}
          onModify={onModify}
          onOpenEstimatedPnlExplanation={jest.fn()}
        />,
        { wrapper },
      );
      expect(screen.getByText('+33.00')).toBeTruthy();
      fireEvent.press(screen.getByText('page.perps.pro.positionTpsl.modify'));
      expect(onModify).toHaveBeenCalledWith(orders[0]);
      list.unmount();

      const modify = render(
        <PerpsProPositionTpSlForm
          {...formProps}
          mode="modify"
          initialOrder={orders[0]}
          position={{ ...precisionPosition, tpslOrders: orders }}
        />,
        { wrapper },
      );
      await act(async () => {});
      const amount = screen.getByTestId('perps-pro-position-tpsl-amount');
      expect(amount.props.value).toBe('5.88');
      fireEvent(amount, 'focus');
      fireEvent(amount, 'blur');
      expect(screen.getByTestId('perps-pro-position-tpsl-amount')).toBe(amount);
      expect(
        screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input')
          .props.value,
      ).toBe('33');
      expect(
        screen.getByTestId('perps-pro-position-tpsl-takeProfit-hint'),
      ).toHaveTextContent(/\+33\.00/);
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
      expect(onReview).not.toHaveBeenCalled();
      expect(placements).toHaveLength(1);
      expect(cancellations).toEqual([]);

      if (reopen === 1) {
        fireEvent.changeText(
          screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input'),
          '30',
        );
        expect(
          screen.getByTestId('perps-pro-position-tpsl-takeProfit-hint'),
        ).toHaveTextContent(/\+30\.00/);
        fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
        await executeDraft();
      }
      modify.unmount();
    }
    expect(
      placements.map(({ size, triggerPx }) => ({ size, triggerPx })),
    ).toEqual([
      { size: '0.00007', triggerPx: '555140' },
      { size: '0.00007', triggerPx: '512290' },
    ]);
    expect(cancellations).toEqual([7]);
    render(
      <PerpsProPositionTpSlOrderList
        {...formProps}
        position={{ ...precisionPosition, tpslOrders: readOrders() }}
        onAdd={jest.fn()}
        onModify={jest.fn()}
        onOpenEstimatedPnlExplanation={jest.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText('+30.00')).toBeTruthy();
  });

  it.each(['first', 'add'] as const)(
    'keeps the %s editor draft and inline Confirm stable while normal hints appear and the keyboard restores',
    async entry => {
      const listeners = new Map<string, Set<(event: any) => void>>();
      const subscription = jest
        .spyOn(Keyboard, 'addListener')
        .mockImplementation((name, callback) => {
          const group = listeners.get(name) ?? new Set();
          listeners.set(name, group);
          group.add(callback);
          return { remove: () => group.delete(callback) };
        });
      const measure = jest.spyOn(UIManager, 'measureInWindow');
      try {
        mockNativeScrollToEnd.mockClear();
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
          position: {
            ...position,
            tpslOrders: entry === 'add' ? [order('partial')] : [],
          },
          review: null,
          skipConfirmation: false,
          visible: true,
        };
        render(<PerpsProPositionTpSlSheets {...props} />, { wrapper });
        await act(async () => {});
        const scroll = screen.getByTestId('perps-pro-position-tpsl-scroll');
        if (entry === 'add')
          fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
        await act(async () => {});
        expect(screen.getByTestId('perps-pro-position-tpsl-scroll')).toBe(
          scroll,
        );
        if (entry === 'add') {
          expect(
            screen.getByTestId('perps-pro-position-tpsl-page-header'),
          ).toBeTruthy();
          expect(
            within(scroll).queryByTestId('perps-pro-position-tpsl-page-header'),
          ).toBeNull();
        }
        const height = entry === 'add' ? 704 : 758;
        const expectedViewport = height - 40 - (entry === 'add' ? 56 : 0);
        expect(
          screen.getByTestId('native-main-sheet').props.snapPoints,
        ).toEqual([height]);
        expect(
          within(scroll).getByTestId('perps-pro-position-tpsl-review'),
        ).toBeTruthy();
        const emit = (name: string) =>
          act(() => {
            listeners
              .get(name)
              ?.forEach(callback =>
                callback({ endCoordinates: { height: 300, screenY: 500 } }),
              );
          });
        emit('keyboardDidShow');
        for (const [kind, price] of [
          ['takeProfit', '130'],
          ['stopLoss', '90'],
        ]) {
          fireEvent.changeText(
            screen.getByTestId(`perps-pro-position-tpsl-${kind}-price`),
            price,
          );
          expect(
            screen.getByTestId(`perps-pro-position-tpsl-${kind}-hint`),
          ).toBeTruthy();
          expect(
            screen.getByTestId('native-main-sheet').props.snapPoints,
          ).toEqual([height]);
        }
        let actualViewport = expectedViewport - 120;
        measure.mockImplementation((node, callback) =>
          callback(
            0,
            100,
            393,
            node === 1001 ? actualViewport : expectedViewport,
          ),
        );
        fireEvent(scroll, 'layout', {
          nativeEvent: {
            layout: { x: 0, y: 0, width: 393, height: actualViewport },
          },
        });
        emit('keyboardDidHide');
        const observer = mockNativeReactions.at(-1)!;
        act(() => observer.react(observer.prepare()));
        act(() => jest.advanceTimersByTime(30));
        expect(mockNativeScrollToEnd).not.toHaveBeenCalled();
        actualViewport = expectedViewport;
        fireEvent(scroll, 'layout', {
          nativeEvent: {
            layout: { x: 0, y: 0, width: 393, height: actualViewport },
          },
        });
        act(() => jest.advanceTimersByTime(30));
        expect(measure).toHaveBeenCalledTimes(2);
        expect(mockNativeScrollToEnd).not.toHaveBeenCalled();
        expect(
          screen.getByTestId('native-main-sheet').props.snapPoints,
        ).toEqual([height]);
        expect(screen.getByTestId('perps-pro-position-tpsl-scroll')).toBe(
          scroll,
        );
        expect(
          screen.getByTestId('perps-pro-position-tpsl-takeProfit-price').props
            .value,
        ).toBe('130');
        expect(
          screen.getByTestId('perps-pro-position-tpsl-stopLoss-price').props
            .value,
        ).toBe('90');
        expect(
          within(scroll).getByTestId('perps-pro-position-tpsl-review'),
        ).toBeTruthy();
        expect(props.onReview).not.toHaveBeenCalled();
      } finally {
        await cleanupAsync();
        subscription.mockRestore();
        measure.mockRestore();
      }
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
