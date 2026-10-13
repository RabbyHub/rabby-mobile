import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          close: jest.fn(),
        }));
        return ReactModule.createElement(View, props);
      },
    ),
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
  BottomSheetBackdrop: require('react-native').View,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/components2024/Button', () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return ReactModule.createElement(
      Pressable,
      { onPress },
      ReactModule.createElement(Text, {}, title),
    );
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = require('@/constant/theme').ThemeColors2024.dark;
    return {
      colors2024,
      styles: getStyle({
        colors2024,
        isLight: false,
        safeAreaInsets: { bottom: 34 },
      }),
    };
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PerpsSimpleCandleIntervalSheet } from './PerpsSimpleCandleIntervalSheet';

describe('Simple interval sheet draft (component unit)', () => {
  it('applies only the confirmed draft, and discards an unconfirmed draft on reopen', () => {
    const confirm = jest.fn();
    const close = jest.fn();
    const props = {
      visible: true,
      selected: '15m' as const,
      onConfirm: confirm,
      onClose: close,
    };
    const view = render(<PerpsSimpleCandleIntervalSheet {...props} />);
    expect(view.getAllByRole('radio')).toHaveLength(12);
    fireEvent.press(view.getByText('3D'));
    expect(confirm).not.toHaveBeenCalled();
    view.rerender(
      <PerpsSimpleCandleIntervalSheet {...props} visible={false} />,
    );
    view.rerender(<PerpsSimpleCandleIntervalSheet {...props} />);
    fireEvent.press(view.getByText('global.confirm'));
    expect(confirm).toHaveBeenLastCalledWith('15m');
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByText('1M'));
    fireEvent.press(view.getByText('global.confirm'));
    expect(confirm).toHaveBeenLastCalledWith('1M');
    fireEvent.press(view.getByText('1m'));
    fireEvent.press(view.getByText('global.confirm'));
    expect(confirm).toHaveBeenLastCalledWith('1m');
  });
});
