import type React from 'react';

jest.mock('@/components', () => {
  const { View } = require('react-native');
  return {
    AssetAvatar: View,
    Tip: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('@/components/AutoLockView', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactActual = jest.requireActual('react');
  const AppBottomSheetModal = ReactActual.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      ReactActual.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        close: jest.fn(),
      }));
      return children;
    },
  );
  return { AppBottomSheetModal };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const { ScrollView, TextInput } = require('react-native');
  return { BottomSheetScrollView: ScrollView, BottomSheetTextInput: TextInput };
});
jest.mock('@/components2024/Button', () => ({ Button: () => null }));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/assets2024/icons/perps/IconInfoCC.svg', () => 'Svg');
jest.mock('@/assets2024/icons/perps/IconTipsLightCC.svg', () => 'Svg');
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/utils/number', () => ({
  splitNumberByStep: (value: unknown) => String(value),
  formatUsdValue: (value: number) => `$${value}`,
  formatPerpsUsdValue: (value: number) => `$${value}`,
  formatPerpsNumber: (value: number) => String(value),
}));
jest.mock('@/utils/perps', () => ({
  calLiquidationPrice: () => 0.1,
  calTransferMarginRequired: () => 1,
  formatPerpsPct: (value: number) => `${value}%`,
  formatPerpsCoin: (coin: string) => coin,
}));
jest.mock('@/screens/Perps/components/PerpsPositionSection/utils', () => ({
  calculateDistanceToLiquidation: () => '10%',
}));
jest.mock('@/components2024/Toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('./PerpsSlider', () => ({ PerpsSlider: () => null }));
jest.mock('./PerpsPriceInfo', () => ({ AssetPriceInfo: () => null }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = new Proxy({}, { get: (_, key) => String(key) });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({
        colors2024,
        isLight: true,
        safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Each platform needs its own module registry because the style factory
// reads Platform.OS at import time; React and the renderer must come from
// the same registry as the component.
const renderAmountInput = (os: 'android' | 'ios') => {
  let style!: Record<string, unknown>;
  jest.isolateModules(() => {
    const RN = require('react-native');
    RN.Platform.OS = os;
    const ReactIsolated: typeof React = require('react');
    // The pure entry avoids registering lifecycle hooks from inside a test.
    const {
      render: renderIsolated,
      cleanup,
    } = require('@testing-library/react-native/pure');
    const {
      PerpsEditMarginPopup,
    }: typeof import('./PerpsEditMarginPopup') = require('./PerpsEditMarginPopup');
    const ui = renderIsolated(
      ReactIsolated.createElement(PerpsEditMarginPopup, {
        visible: true,
        direction: 'Long',
        coin: 'DOGE',
        markPrice: 0.08,
        entryPrice: 0.08,
        leverage: 5,
        leverageMax: 10,
        pxDecimals: 6,
        szDecimals: 0,
        availableBalance: 10,
        liquidationPx: 0.09,
        positionSize: 367,
        marginUsed: 2.93,
        pnlPercent: 0,
        pnl: 0,
        marginMode: 'isolated',
        activeAssetCtx: null,
        currentAssetCtx: null,
        handlePressRiskTag: jest.fn(),
        onCancel: jest.fn(),
        onConfirm: jest.fn(async () => {}),
      }),
    );
    style = RN.StyleSheet.flatten(ui.getByPlaceholderText('$2.93').props.style);
    cleanup();
  });
  return style;
};

const originalOS = require('react-native').Platform.OS;
afterEach(() => {
  require('react-native').Platform.OS = originalOS;
});

it('keeps natural Android metrics in a fixed box so slider updates cannot shift the amount', () => {
  const style = renderAmountInput('android');
  expect(style).toMatchObject({
    fontSize: 36,
    height: 42,
    includeFontPadding: false,
    textAlignVertical: 'center',
  });
  expect(style).not.toHaveProperty('lineHeight');
});

it('keeps the iOS amount line height unchanged', () => {
  const style = renderAmountInput('ios');
  expect(style).toMatchObject({
    fontSize: 36,
    lineHeight: 42,
    fontFamily: 'SF Pro Rounded',
  });
  expect(style).not.toHaveProperty('height');
  expect(style).not.toHaveProperty('includeFontPadding');
});
