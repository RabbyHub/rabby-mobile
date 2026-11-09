import React from 'react';
import { Keyboard, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { AccountSwitcherModal } from './Modal';

const mockPresent = jest.fn();
jest.mock('@/components/customized/BottomSheet', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return {
    AppBottomSheetModal: forwardRef(
      ({ children }: { children: React.ReactNode }, ref: unknown) => {
        useImperativeHandle(ref, () => ({
          present: mockPresent,
          dismiss: jest.fn(),
          close: jest.fn(),
        }));
        return children;
      },
    ),
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: () => null,
  BottomSheetScrollView: require('react-native').View,
}));
jest.mock('./hooks', () => ({
  useAccountSceneVisible: () => ({
    isVisible: true,
    toggleSceneVisible: jest.fn(),
  }),
}));
jest.mock('./AccountsPanel', () => ({ AccountsPanelInModal: () => null }));
jest.mock('./dappAccountSwitcherServices', () => ({
  withDappAccountSwitcherServices: (component: unknown) => component,
}));
jest.mock('../AutoLockView', () => require('react-native').View);
jest.mock('@/hooks/storeActivity/RenderActivityBoundary', () => ({
  RenderActivityBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {}, isLight: true }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));

describe('AccountSwitcherModal', () => {
  it('closes the keyboard when it opens, not again on every re-render', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const Screen = ({ tick }: { tick: number }) => (
      <View testID={`tick-${tick}`}>
        <AccountSwitcherModal forScene="MakeTransactionAbout" />
      </View>
    );
    const { rerender } = render(<Screen tick={0} />);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(mockPresent).toHaveBeenCalledTimes(1);

    // The screen re-renders when a field in a dialog over the switcher opens
    // the keyboard; closing it again would blur that field.
    rerender(<Screen tick={1} />);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });
});
