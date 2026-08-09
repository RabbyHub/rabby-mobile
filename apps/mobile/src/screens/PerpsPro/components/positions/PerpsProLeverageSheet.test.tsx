import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components/AutoLockView', () => require('react-native').View);

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          children,
          testID: 'leverage-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/Button', () => ({
  Button: ({
    onPress,
    title,
    ...props
  }: {
    onPress: () => void;
    title: string;
  }) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return ReactModule.createElement(
      Pressable,
      { ...props, onPress },
      ReactModule.createElement(Text, null, title),
    );
  },
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 34 } }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { leverage?: number }) =>
      key.endsWith('adjustLeverage')
        ? 'Adjust Leverage'
        : key.endsWith('upToLeverage')
        ? `Up To ${params?.leverage}x`
        : 'Confirm',
  }),
}));

jest.mock('../common/PerpsProSlider', () => ({
  PerpsProSlider: (props: object) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, {
      ...props,
      testID: 'leverage-slider',
    });
  },
}));

import { PerpsProLeverageSheet } from './PerpsProLeverageSheet';

describe('PerpsProLeverageSheet', () => {
  it('matches the compact Figma contract and confirms the draft value', () => {
    const onConfirm = jest.fn();
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        pending={false}
        visible
      />,
    );

    expect(screen.getByTestId('leverage-sheet').props.snapPoints).toEqual([
      288,
    ]);
    expect(screen.getByText('Adjust Leverage')).toBeTruthy();
    expect(screen.getByText('Up To 40x')).toBeTruthy();
    expect(screen.getByText('20x')).toBeTruthy();
    expect(screen.getByTestId('leverage-slider').props).toMatchObject({
      pointCount: 5,
      tone: 'neutral',
    });

    fireEvent.press(screen.getByTestId('perps-pro-leverage-increment'));
    expect(screen.getByText('21x')).toBeTruthy();
    fireEvent.press(screen.getByTestId('perps-pro-leverage-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(21);
    expect(screen.getByTestId('perps-pro-leverage-confirm').props.height).toBe(
      36,
    );
    expect(screen.getByTestId('perps-pro-leverage-confirm').props.type).toBe(
      'primary',
    );
  });
});
