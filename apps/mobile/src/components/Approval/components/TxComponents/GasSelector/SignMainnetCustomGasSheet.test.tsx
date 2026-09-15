import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import BigNumber from 'bignumber.js';
import type { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { apiProvider } from '@/core/apis';
import { useFindChain } from '@/hooks/useFindChain';
import { SignMainnetCustomGasSheet } from './SignMainnetCustomGasSheet';

// Component/unit coverage: exercise the actual sheet, gas cards and confirm
// payload. Replace native presentation, app context and the gas API boundary.
jest.mock('@/core/apis', () => ({ apiProvider: { gasMarketV2: jest.fn() } }));
jest.mock('@/hooks/useFindChain', () => ({ useFindChain: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ colors2024: {}, styles: {} }),
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 0 }),
}));
jest.mock('@/utils/styles', () => ({ createGetStyles2024: () => () => ({}) }));
jest.mock('@/core/native/utils', () => ({ IS_ANDROID: false, IS_IOS: true }));
jest.mock('@/utils/transaction', () => ({
  calcMaxPriorityFee: (_list: GasLevel[], gas: GasLevel) => gas.price,
}));
jest.mock('@/utils/number', () => ({
  formatGasHeaderUsdValue: (value: string) => `$${value}`,
  formatTokenAmount: (value: string) => value,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').View,
  BottomSheetTextInput: require('react-native').TextInput,
}));
jest.mock('@rneui/themed', () => ({
  Skeleton: () => {
    const { View } = require('react-native');
    return <View testID="gas-estimate-loading" />;
  },
}));
jest.mock('@/components', () => {
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    AppBottomSheetModalTitle: () => null,
    Tip: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock('@/components2024/FooterButton/FooterButton', () => ({
  FooterButton: ({ onPress, disabled, loading, title }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: loading }}
        disabled={disabled}
        onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/components2024/CheckBox', () => ({ CheckBoxRect: () => null }));
jest.mock('@/screens/Approvals/icons', () => ({ RcIconUnknown: () => null }));
jest.mock('../../Actions/components/Divide', () => ({ Divide: () => null }));
jest.mock('@/assets/icons/common/info-cc.svg', () => () => null);

type SheetProps = React.ComponentProps<typeof SignMainnetCustomGasSheet>;
const fastGas: GasLevel = {
  level: 'fast',
  price: 7_500_000,
  priority_price: 7_500_000,
  base_fee: 0,
  front_tx_count: 0,
  estimated_seconds: 0,
};
const customGas: GasLevel = { ...fastGas, level: 'custom', price: 0 };
const gasList = [fastGas, customGas];
const estimate = jest.mocked(apiProvider.gasMarketV2);

const props = (): SheetProps => ({
  visible: true,
  onClose: jest.fn(),
  tx: {} as SheetProps['tx'],
  gasLimit: '21000',
  gas: { success: true, gasCostUsd: 0, gasCostAmount: 0 },
  version: 'v0',
  chainId: 12345,
  onChange: jest.fn(),
  isReady: true,
  nonce: '3',
  gasList,
  selectedGas: fastGas,
  is1559: false,
  isHardware: false,
  gasCalcMethod: async price => ({
    gasCostUsd: new BigNumber(0),
    gasCostAmount: new BigNumber(price).times(21000).div(1e18),
  }),
  nativeTokenBalance: '1000000000000000000',
  gasPriceMedian: null,
  isCancel: false,
  isSpeedUp: false,
  account: {} as SheetProps['account'],
});

const setTestnet = (isTestnet: boolean) => {
  jest.mocked(useFindChain).mockReturnValue({
    id: 12345,
    isTestnet,
    nativeTokenSymbol: 'ETH',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'native',
  } as NonNullable<ReturnType<typeof useFindChain>>);
};
const enterGas = (text: string) => {
  fireEvent(screen.getByPlaceholderText('0'), 'change', {
    stopPropagation: jest.fn(),
    nativeEvent: { text },
  });
};
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
};
const confirm = () => screen.getByRole('button', { name: 'global.confirm' });
const deferred = () => {
  let resolve!: (levels: GasLevel[]) => void;
  const promise = new Promise<GasLevel[]>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

beforeEach(() => {
  jest.useFakeTimers();
  estimate.mockReset();
  setTestnet(true);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('custom network gas finishes loading and confirms the entered price', async () => {
  const input = props();
  render(<SignMainnetCustomGasSheet {...input} />);
  expect(confirm()).toBeDisabled();
  enterGas('0.0001');
  await settle();

  expect(estimate).not.toHaveBeenCalled();
  expect(screen.queryByTestId('gas-estimate-loading')).toBeNull();
  expect(confirm()).toBeEnabled();
  expect(confirm()).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ busy: false }),
  );
  fireEvent.press(confirm());
  expect(input.onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'custom',
      price: 100_000,
      gasLimit: 21000,
      nonce: 3,
    }),
  );
  expect(input.onClose).toHaveBeenCalledTimes(1);
});

test.each(['missing', 'rejected'])(
  'an optional %s estimate does not block a manual price',
  async mode => {
    setTestnet(false);
    if (mode === 'missing') {
      estimate.mockResolvedValue([]);
    } else {
      estimate.mockRejectedValue(new Error('estimate unavailable'));
    }
    const input = props();
    render(<SignMainnetCustomGasSheet {...input} />);
    enterGas('0.0002');
    await settle();
    expect(confirm()).toBeEnabled();
    fireEvent.press(confirm());
    expect(input.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'custom', price: 200_000 }),
    );
  },
);

test('an older response cannot clear loading or replace a newer custom price', async () => {
  setTestnet(false);
  const first = deferred();
  const second = deferred();
  estimate
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const input = props();
  render(<SignMainnetCustomGasSheet {...input} />);
  enterGas('0.0001');
  await settle();
  enterGas('0.0002');
  await settle();
  await act(async () =>
    first.resolve([{ ...customGas, estimated_seconds: 90 }]),
  );
  expect(confirm()).toBeDisabled();
  await act(async () =>
    second.resolve([{ ...customGas, estimated_seconds: 12 }]),
  );
  expect(confirm()).toBeEnabled();
  fireEvent.press(confirm());
  expect(input.onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'custom',
      price: 200_000,
      estimated_seconds: 12,
    }),
  );
});

test('selecting a preset discards a pending custom estimate', async () => {
  setTestnet(false);
  const pending = deferred();
  estimate.mockReturnValue(pending.promise);
  const input = props();
  render(<SignMainnetCustomGasSheet {...input} />);
  enterGas('0.0001');
  await settle();
  fireEvent.press(screen.getByText('page.sendToken.GasSelector.level.fast'), {
    stopPropagation: jest.fn(),
  });
  await act(async () => pending.resolve([customGas]));
  fireEvent.press(confirm());
  expect(input.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ level: 'fast', price: fastGas.price }),
  );
});

test('clearing input cancels the debounce and keeps confirmation disabled', async () => {
  setTestnet(false);
  render(<SignMainnetCustomGasSheet {...props()} />);
  enterGas('0.0001');
  enterGas('');
  await settle();
  expect(estimate).not.toHaveBeenCalled();
  expect(confirm()).toBeDisabled();
  expect(confirm()).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ busy: false }),
  );
});

test('closing the sheet discards an estimate before reopening', async () => {
  setTestnet(false);
  const pending = deferred();
  estimate.mockReturnValue(pending.promise);
  const input = props();
  const { rerender } = render(<SignMainnetCustomGasSheet {...input} />);
  enterGas('0.0001');
  await settle();
  rerender(<SignMainnetCustomGasSheet {...input} visible={false} />);
  await act(async () => pending.resolve([customGas]));
  setTestnet(true);
  rerender(<SignMainnetCustomGasSheet {...input} />);
  expect(confirm()).toBeDisabled();
  enterGas('0.0003');
  await settle();
  fireEvent.press(confirm());
  expect(input.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ level: 'custom', price: 300_000 }),
  );
});
