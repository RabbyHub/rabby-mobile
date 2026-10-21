jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleAccount/order-type-switch.svg',
  () => require('react-native').View,
);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('@/utils/number', () => ({
  splitNumberByStep: (value: unknown) => String(value),
  formatUsdValue: (value: number) => `$${value.toFixed(2)}`,
}));
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ScrollView, View } from 'react-native';
import { Button } from '@/components2024/Button';
import { PerpsClosePositionPopup } from './PerpsClosePositionPopup';

jest.mock('@/hooks/theme', () => {
  const colors2024 = new Proxy({}, { get: (_, key) => String(key) });
  return {
    useTheme2024: ({ getStyle }: any) => ({
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    }),
  };
});
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('@/components/AutoLockView', () => ({
  __esModule: true,
  default: require('react-native').View,
}));
jest.mock('@/components/customized/BottomSheet', () => ({
  AppBottomSheetModal: require('react').forwardRef(
    (
      {
        children,
        backgroundComponent: Background,
        footerComponent: Footer,
        ...p
      }: any,
      ref: any,
    ) => {
      require('react').useImperativeHandle(ref, () => ({
        present: jest.fn(),
        close: jest.fn(),
      }));
      return require('react').createElement(
        require('react-native').View,
        { ...p, testID: 'sheet' },
        Background && require('react').createElement(Background),
        children,
        Footer && require('react').createElement(Footer),
      );
    },
  ),
}));
// Keep makeBottomSheetProps real: it creates the background component type.
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock(
  '@/components2024/GlobalBottomSheetModal/BackgroundComponent',
  () => ({
    BackgroundComponent: () => {
      require('react').useEffect(() => {
        mockBackgroundMount();
        return mockBackgroundUnmount;
      }, []);
      return null;
    },
  }),
);
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
  BottomSheetScrollView: require('react-native').ScrollView,
  BottomSheetFooter: ({ children }: any) => {
    require('react').useEffect(() => {
      mockFooterMount();
      return mockFooterUnmount;
    }, []);
    return children;
  },
}));
jest.mock('@/components2024/Button', () => ({
  Button: (p: any) =>
    require('react').createElement(require('react-native').Pressable, {
      ...p,
      testID: 'confirm',
      disabled: p.disabled || p.loading,
    }),
}));
jest.mock('./PerpsSlider', () => ({
  PerpsSlider: (p: any) =>
    require('react').createElement(require('react-native').View, {
      ...p,
      testID: 'slider',
    }),
}));
jest.mock('./PerpEditLimitPriceTag', () => ({
  PerpEditLimitPriceTag: (p: any) =>
    require('react').createElement(require('react-native').View, {
      ...p,
      testID: 'limit-price',
    }),
}));
jest.mock('../hooks/useMarketSlippage', () => ({
  useMarketSlippage: () => ({ isReady: false, shouldShow: false }),
}));
jest.mock('./MarketSlippage', () => ({ MarketSlippage: () => null }));
jest.mock('@/utils/perps', () => ({
  formatTpOrSlPrice: (v: number) => String(v),
  isMarketableLimit: () => false,
}));

const mockBackgroundMount = jest.fn();
const mockBackgroundUnmount = jest.fn();
const mockFooterMount = jest.fn();
const mockFooterUnmount = jest.fn();
beforeEach(() => jest.clearAllMocks());

const props: React.ComponentProps<typeof PerpsClosePositionPopup> = {
  visible: true,
  coin: 'ETH',
  displayName: 'ETH',
  direction: 'Long',
  positionSize: '1.23456',
  marginUsed: 20,
  markPrice: 100,
  entryPrice: 90,
  szDecimals: 3,
  providerFee: 0,
  pnl: 0.0043,
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
  handleClosePosition: jest.fn(async () => {}),
};

it('summarizes selected submitted quantity, keeps 1% and two-place PnL, submits original percent', async () => {
  const submit = jest.fn(async () => {});
  const ui = render(
    <PerpsClosePositionPopup {...props} handleClosePosition={submit} />,
  );
  expect(ui.getByText('100%')).toBeTruthy();
  expect(ui.getByText('+$0.00')).toBeTruthy();
  expect(ui.getByTestId('slider').props).toMatchObject({
    step: 1,
    variant: 'close',
  });
  act(() => ui.getByTestId('slider').props.onValueChange(53));
  expect(ui.getByText('65.40 USDC = 0.654 ETH')).toBeTruthy();
  await act(async () => fireEvent.press(ui.getByTestId('confirm')));
  expect(submit).toHaveBeenCalledWith({
    closePercent: 53,
    orderType: 'market',
    limitPx: undefined,
  });
  ui.rerender(<PerpsClosePositionPopup {...props} visible={false} />);
  ui.rerender(<PerpsClosePositionPopup {...props} />);
  expect(ui.getByText('100%')).toBeTruthy();
});

it('keeps min-close guard and uses the typed limit price for PnL', async () => {
  const ui = render(<PerpsClosePositionPopup {...props} />);
  act(() => ui.getByTestId('slider').props.onValueChange(0));
  expect(ui.getByTestId('confirm')).toBeDisabled();
  act(() => ui.getByTestId('slider').props.onValueChange(100));
  fireEvent.press(
    ui.getByText('page.perpsDetail.PerpsOpenPositionPopup.orderTypeMarket'),
  );
  expect(ui.getByTestId('limit-price').props).toMatchObject({
    variant: 'close',
    direction: 'Short',
    initLimitPrice: '100',
  });
  await act(async () =>
    ui.getByTestId('limit-price').props.handleSetLimitPx('120'),
  );
  expect(ui.getByText('+$37.04')).toBeTruthy();
  await act(async () => fireEvent.press(ui.getByTestId('confirm')));
  expect(props.handleClosePosition).toHaveBeenCalledWith({
    closePercent: 100,
    orderType: 'limit',
    limitPx: '120',
  });
});

it('reserves the warning space and keeps the background and footer mounted across drag and mode changes', () => {
  const ui = render(<PerpsClosePositionPopup {...props} />);
  const warning = () =>
    ui.getByText('page.perpsDetail.PerpsClosePositionPopup.minimumWarning', {
      includeHiddenElements: true,
    });
  const initialWarning = warning();
  const initialConfirm = ui.getByTestId('confirm');
  const initialSnap = ui.getByTestId('sheet').props.snapPoints;
  expect(warning()).toHaveStyle({ opacity: 0 });
  for (const value of [53, 0, 8, 100]) {
    act(() => ui.getByTestId('slider').props.onValueChange(value));
    expect(warning()).toBe(initialWarning);
    expect(warning().props.accessibilityElementsHidden).toBe(value >= 9);
    expect(ui.getByTestId('sheet').props.snapPoints).toEqual(initialSnap);
    expect(ui.getByTestId('confirm')).toBe(initialConfirm);
  }
  act(() => ui.getByTestId('slider').props.onSlidingComplete());
  fireEvent.press(
    ui.getByText('page.perpsDetail.PerpsOpenPositionPopup.orderTypeMarket'),
  );
  expect(ui.getByTestId('sheet').props.snapPoints[0]).toBe(initialSnap[0] + 44);
  fireEvent.press(
    ui.getByText('page.perpsDetail.PerpsOpenPositionPopup.orderTypeLimit'),
  );
  expect(ui.getByTestId('sheet').props.snapPoints).toEqual(initialSnap);
  expect(mockBackgroundMount).toHaveBeenCalledTimes(1);
  expect(mockFooterMount).toHaveBeenCalledTimes(1);
  expect(mockBackgroundUnmount).not.toHaveBeenCalled();
  expect(mockFooterUnmount).not.toHaveBeenCalled();
});

it('defers body height changes until drag release and measures footer space separately', () => {
  const ui = render(<PerpsClosePositionPopup {...props} />);
  const body = () =>
    ui
      .UNSAFE_getByType(ScrollView)
      .findAllByType(View)
      .find(node => node.props.onLayout);
  const layoutBody = (height: number) =>
    act(() =>
      body()!.props.onLayout({
        nativeEvent: { layout: { height } },
      }),
    );
  layoutBody(385);
  const initialSnap = ui.getByTestId('sheet').props.snapPoints[0];
  act(() => ui.getByTestId('slider').props.onSlidingStart());
  act(() => ui.getByTestId('slider').props.onValueChange(26));
  layoutBody(403);
  layoutBody(421);
  expect(ui.getByTestId('sheet').props.snapPoints[0]).toBe(initialSnap);
  act(() => ui.getByTestId('slider').props.onSlidingComplete());
  expect(ui.getByTestId('sheet').props.snapPoints[0]).toBe(initialSnap + 36);
  expect(
    ui.UNSAFE_getByType(ScrollView).props.contentContainerStyle.paddingBottom,
  ).toBe(initialSnap - 385 - 36);
  // Track taps publish their value before slidingStart.
  act(() => ui.getByTestId('slider').props.onValueChange(24));
  layoutBody(403);
  expect(ui.getByTestId('sheet').props.snapPoints[0]).toBe(initialSnap + 36);
  act(() => ui.getByTestId('slider').props.onSlidingComplete());
  expect(ui.getByTestId('sheet').props.snapPoints[0]).toBe(initialSnap + 18);
});

it('keeps the footer mounted while publishing loading and the latest submit guard', async () => {
  let resolve!: () => void;
  const submit = jest.fn(
    () =>
      new Promise<void>(done => {
        resolve = done;
      }),
  );
  const ui = render(
    <PerpsClosePositionPopup {...props} handleClosePosition={submit} />,
  );
  const press = ui.UNSAFE_getByType(Button).props.onPress;
  act(() => ui.getByTestId('slider').props.onValueChange(0));
  await act(async () => press());
  expect(submit).not.toHaveBeenCalled();
  act(() => ui.getByTestId('slider').props.onValueChange(53));
  act(() => {
    void press();
  });
  expect(ui.getByTestId('confirm')).toBeDisabled();
  expect(ui.getByTestId('confirm').props.loading).toBe(true);
  await act(async () => press());
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(ui.getByTestId('confirm')).not.toBeDisabled();
  expect(mockFooterMount).toHaveBeenCalledTimes(1);
  expect(mockFooterUnmount).not.toHaveBeenCalled();
});
