import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockOpenFieldExplanation = jest.fn();

jest.mock(
  '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/common/checkbox-empty-cc.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/common/checkbox-filled-brand.svg',
  () => require('react-native').View,
);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('../common/PerpsProDottedUnderlineText', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({
      accessibilityLabel,
      children,
      onPress,
      style,
    }: any) =>
      onPress
        ? ReactModule.createElement(
            Pressable,
            { accessibilityLabel, accessibilityRole: 'button', onPress },
            ReactModule.createElement(Text, { style }, children),
          )
        : ReactModule.createElement(Text, { style }, children),
  };
});
jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));

import {
  PerpsProTradeCheckbox,
  PerpsProTradeSummaryRow,
} from './PerpsProTradePrimitives';

describe('PerpsProTradePrimitives explanations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps checkbox state changes separate from TP/SL explanation presses', () => {
    const onPress = jest.fn();
    render(
      <PerpsProTradeCheckbox
        explanationKey="tpSl"
        label="TP/SL"
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByRole('checkbox'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockOpenFieldExplanation).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('tpSl');
  });

  it('keeps a disabled Reduce Only explanation available', () => {
    render(
      <PerpsProTradeCheckbox
        disabled
        explanationKey="reduceOnly"
        label="Reduce Only"
      />,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('reduceOnly');
  });

  it.each([
    ['Cost', 'cost'],
    ['Liq. Price', 'estimatedLiquidationPrice'],
  ] as const)('maps %s to its own explanation key', (label, explanationKey) => {
    render(
      <PerpsProTradeSummaryRow
        dottedLabel
        explanationKey={explanationKey}
        label={label}
        value="--"
      />,
    );

    fireEvent.press(screen.getByRole('button'));
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith(explanationKey);
  });
});
