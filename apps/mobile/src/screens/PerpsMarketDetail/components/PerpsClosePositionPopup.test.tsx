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
import { PerpsClosePositionPopup } from './PerpsClosePositionPopup';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = new Proxy({}, { get: (_, key) => String(key) });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    };
  },
}));
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
    ({ children }: any, ref: any) => {
      require('react').useImperativeHandle(ref, () => ({
        present: jest.fn(),
        close: jest.fn(),
      }));
      return children;
    },
  ),
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
  BottomSheetScrollView: require('react-native').ScrollView,
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
