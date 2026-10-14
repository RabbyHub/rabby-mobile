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

describe('Simple interval sheet (component unit)', () => {
  it('selects immediately, closes, and distinguishes minutes from months', () => {
    const confirm = jest.fn();
    const close = jest.fn();
    const prefetch = jest.fn();
    const view = render(
      <PerpsSimpleCandleIntervalSheet
        visible
        selected="30m"
        onConfirm={confirm}
        onClose={close}
        onPrefetch={prefetch}
      />,
    );
    expect(view.getAllByRole('radio')).toHaveLength(12);
    fireEvent(view.getByText('3D'), 'pressIn');
    expect(prefetch).toHaveBeenCalledWith('3d');
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('3D'));
    expect(confirm).toHaveBeenLastCalledWith('3d');
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByText('1M'));
    expect(confirm).toHaveBeenLastCalledWith('1M');
    fireEvent.press(view.getByText('1m'));
    expect(confirm).toHaveBeenLastCalledWith('1m');
    expect(close).toHaveBeenCalledTimes(3);
  });
  it('the Close button dismisses without applying an interval', () => {
    const confirm = jest.fn();
    const close = jest.fn();
    const view = render(
      <PerpsSimpleCandleIntervalSheet
        visible
        selected="4h"
        onConfirm={confirm}
        onClose={close}
      />,
    );
    expect(view.getByRole('radio', { checked: true })).toHaveTextContent('4h');
    fireEvent.press(view.getByText('global.closeButton'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });
});
