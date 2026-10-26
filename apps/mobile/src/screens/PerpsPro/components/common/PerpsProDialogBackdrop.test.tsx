import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { uiRefreshTimeout } from '@/core/apis/autoLock';
import { PerpsProDialogBackdrop } from './PerpsProDialogBackdrop';

jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ colors2024: { 'neutral-black': '#000000' } }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetBackdrop: (props: object) => {
    const ReactModule = require('react');
    return ReactModule.createElement(require('react-native').Pressable, {
      ...props,
      testID: 'native-backdrop',
    });
  },
}));

describe('Pro dialog backdrop adapter', () => {
  it.each(['close', 'none'] as const)(
    'preserves %s dismissal and auto-lock refresh with the new opacity',
    pressBehavior => {
      render(
        <PerpsProDialogBackdrop
          animatedIndex={{ value: 0 } as never}
          animatedPosition={{ value: 0 } as never}
          pressBehavior={pressBehavior}
        />,
      );
      const backdrop = screen.getByTestId('native-backdrop');
      expect(backdrop.props).toMatchObject({
        pressBehavior,
        opacity: 0.3,
        appearsOnIndex: 0,
        disappearsOnIndex: -1,
      });
      expect(StyleSheet.flatten(backdrop.props.style)).toMatchObject({
        backgroundColor: '#000000',
      });
      fireEvent.press(backdrop);
      expect(uiRefreshTimeout).toHaveBeenCalled();
    },
  );
});
