import React from 'react';
import BigNumber from 'bignumber.js';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { GasLevel, Tx } from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/startupServices/preference';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').ScrollView,
  BottomSheetTextInput: require('react-native').TextInput,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const { ThemeColors, ThemeColors2024 } = require('@/constant/theme');
    return {
      colors2024: ThemeColors2024.light,
      styles: getStyle.getStyles({
        classicalColors: ThemeColors.light,
        colors: ThemeColors.light,
        colors2024: ThemeColors2024.light,
        isLight: true,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    };
  },
}));

jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 0 }),
}));

jest.mock('@/hooks/useFindChain', () => {
  const chain = {
    id: 'eth',
    isTestnet: true,
    nativeTokenAddress: 'eth',
    nativeTokenSymbol: 'ETH',
    nativeTokenDecimals: 18,
  };
  return { useFindChain: () => chain };
});

jest.mock('@/core/apis', () => ({
  apiProvider: { gasMarketV2: jest.fn() },
}));

jest.mock('@/utils/transaction', () => ({
  calcMaxPriorityFee: () => 1e9,
}));

jest.mock('@/utils/number', () => ({
  formatGasHeaderUsdValue: (value: string) => value,
  formatTokenAmount: (value: string) => value,
}));

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      ({ children }: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          close: jest.fn(),
        }));
        return ReactModule.createElement(View, null, children);
      },
    ),
    AppBottomSheetModalTitle: () => null,
    Tip: ({ children }: any) => children,
  };
});

jest.mock('@/components2024/FooterButton/FooterButton', () => ({
  FooterButton: () => null,
}));

jest.mock('@/components2024/CheckBox', () => ({
  CheckBoxRect: () => null,
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/screens/Approvals/icons', () => ({
  RcIconUnknown: () => null,
}));

jest.mock('../../Actions/components/Divide', () => ({
  Divide: () => null,
}));

jest.mock('@/assets/icons/common/info-cc.svg', () => () => null);

// Preset selection is outside the input's controlled-value/geometry contract.
// Invoke the real sheet's selection handler before editing the priority fee.
jest.mock('./GasSelectContainer', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    GasSelectContainer: ({ gasList, panelSelection }: any) =>
      ReactModule.createElement(Pressable, {
        testID: 'normal-gas-preset',
        onPress: () =>
          panelSelection({ stopPropagation: jest.fn() }, gasList[0]),
      }),
  };
});

import { SignMainnetCustomGasSheet } from './SignMainnetCustomGasSheet';

const originalOS = Platform.OS;
const gasLevel: GasLevel = {
  level: 'normal',
  price: 2e9,
  priority_price: 1e9,
  base_fee: 1e9,
  estimated_seconds: 15,
  front_tx_count: 0,
};

afterEach(() => {
  Platform.OS = originalOS;
});

// Component contract only: real input handler and real styles, with native
// sheet/input boundaries mocked. Native Android measurement still needs QA.
describe('SignMainnetCustomGasSheet priority fee geometry', () => {
  it('keeps the Android input slot through empty, typed and cleared values', async () => {
    Platform.OS = 'android';
    const onChange = jest.fn();
    const onClose = jest.fn();
    const gasCalcMethod = jest.fn(async () => ({
      gasCostUsd: new BigNumber(1),
      gasCostAmount: new BigNumber(0.001),
    }));
    const view = render(
      <SignMainnetCustomGasSheet
        visible
        onClose={onClose}
        tx={{ chainId: 1 } as Tx}
        gas={{ gasCostUsd: 1, gasCostAmount: 0.001, success: true }}
        version="v2"
        chainId={1}
        onChange={onChange}
        isReady
        nonce="0"
        gasList={[gasLevel]}
        selectedGas={gasLevel}
        is1559
        isHardware={false}
        gasCalcMethod={gasCalcMethod}
        nativeTokenBalance="0"
        gasPriceMedian={null}
        isCancel={false}
        isSpeedUp={false}
        account={
          { address: '0x0000000000000000000000000000000000000001' } as Account
        }
      />,
    );
    await act(async () => {});
    fireEvent.press(view.getByTestId('normal-gas-preset'));
    await act(async () => {});

    const input = view.UNSAFE_getByType(TextInput);
    expect(input.props.value).toBe('1');
    const initialStyle = StyleSheet.flatten(input.props.style);
    expect(initialStyle).toMatchObject({
      height: 58,
      lineHeight: 22,
      paddingVertical: 18,
      includeFontPadding: false,
      textAlignVertical: 'center',
    });

    for (const value of ['', '0.', '0.1', '']) {
      fireEvent(input, 'change', { nativeEvent: { text: value } });
      const currentInput = view.UNSAFE_getByType(TextInput);
      expect(currentInput).toBe(input);
      expect(currentInput.props.value).toBe(value || undefined);
      expect(StyleSheet.flatten(currentInput.props.style)).toEqual(
        initialStyle,
      );
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
