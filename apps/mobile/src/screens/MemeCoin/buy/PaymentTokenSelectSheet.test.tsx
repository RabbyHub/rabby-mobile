import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { PaymentAsset } from '../engine/types';
import type { BuySummary } from '../ui/helpers';
import { PaymentTokenSelectSheet } from './PaymentTokenSelectSheet';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
let mockOnDismiss: (() => void) | undefined;
let mockOnChange: ((index: number) => void) | undefined;
let mockAnimationConfigs: unknown;

jest.mock('@/components/customized/BottomSheet', () => {
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    AppBottomSheetModal: ({
      ref,
      children,
      onDismiss,
      onChange,
      animationConfigs,
    }: {
      ref: unknown;
      children: unknown;
      onDismiss?: () => void;
      onChange?: (index: number) => void;
      animationConfigs?: unknown;
    }) => {
      mockOnDismiss = onDismiss;
      mockOnChange = onChange;
      mockAnimationConfigs = animationConfigs;
      useImperativeHandle(ref, () => ({
        present: mockPresent,
        dismiss: mockDismiss,
      }));
      return children;
    },
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: jest.requireActual('react-native').ScrollView,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@rneui/themed', () => ({ Skeleton: () => null }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {}, isLight: true }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { amount?: string }) =>
      options?.amount ? `${key}:${options.amount}` : key,
  }),
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd.toFixed(2)}`,
}));
jest.mock('@/components2024/Button', () => {
  const { createElement } = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      createElement(
        TouchableOpacity,
        { onPress, disabled },
        createElement(Text, null, title),
      ),
  };
});
jest.mock('@/constant/layout', () => ({
  BOTTOM_BUTTON_SINGLE_HEIGHT: 52,
  BOTTOM_BUTTON_TOP_OFFSET: 12,
  getBottomButtonBottomOffset: () => 36,
  getBottomButtonCenteredTitleStyle: () => ({}),
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 0 }),
}));
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('@/assets2024/memecoin/check.svg', () => () => null);
jest.mock('@/assets2024/memecoin/empty-meme-light.svg', () => () => null);
jest.mock('@/assets2024/memecoin/empty-meme-dark.svg', () => () => null);

const eth: PaymentAsset = {
  id: '0xeth',
  chain: 'eth',
  symbol: 'ETH',
  usdValue: 200,
  price: 1,
  isNative: true,
};

const renderSheet = (
  over: Partial<React.ComponentProps<typeof PaymentTokenSelectSheet>> = {},
) => {
  const onClose = jest.fn();
  const onToggle = jest.fn();
  const summary: BuySummary = { kind: 'none', neededUsd: 100 };
  const props = {
    visible: true,
    onClose,
    assets: [eth],
    selectedKeys: [],
    onToggle,
    listReady: true,
    paymentBySource: {},
    summary,
    logoByKey: new Map<string, string>(),
    ...over,
  };
  const utils = render(<PaymentTokenSelectSheet {...props} />);
  return { ...utils, onClose, onToggle, props };
};

describe('PaymentTokenSelectSheet', () => {
  beforeEach(() => {
    mockPresent.mockClear();
    mockDismiss.mockClear();
  });

  it('follows visible', () => {
    const { rerender, props } = renderSheet();
    expect(mockPresent).toHaveBeenCalledTimes(1);
    rerender(<PaymentTokenSelectSheet {...props} visible={false} />);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('is already open on entry, and slides as usual after that', () => {
    renderSheet();
    expect(mockAnimationConfigs).toEqual({ duration: 0 });
    act(() => mockOnChange?.(0));
    expect(mockAnimationConfigs).toBeUndefined();
  });

  it('closes when the sheet is swiped away', () => {
    const { onClose } = renderSheet();
    mockOnDismiss?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for the whole amount when nothing is selected', () => {
    const { getByText, onClose } = renderSheet();
    fireEvent.press(getByText('page.memeCoin.buy.needed:$100'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks for the shortfall when the selection is not enough', () => {
    const { getByText, onClose } = renderSheet({
      summary: { kind: 'short', shortfallUsd: 65.21 },
    });
    fireEvent.press(getByText('page.memeCoin.buy.anotherNeeded:$65.21'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Confirm once the selection is enough', () => {
    const { getByText, onClose } = renderSheet({
      summary: { kind: 'enough' },
    });
    fireEvent.press(getByText('page.memeCoin.buy.confirm'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles a token and shows its estimated payment once selected', () => {
    const { getByText, onToggle } = renderSheet({
      selectedKeys: ['eth:0xeth'],
      paymentBySource: { 'eth:0xeth': 80.02 },
    });
    getByText('page.memeCoin.buy.estPayment:$80.02');
    fireEvent.press(getByText('ETH'));
    expect(onToggle).toHaveBeenCalledWith('eth:0xeth');
  });

  it('says so when there is nothing to pay with', () => {
    const { getByText } = renderSheet({ assets: [] });
    getByText('page.memeCoin.buy.noAssets');
  });
});
