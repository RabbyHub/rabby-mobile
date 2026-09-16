const mockClose = jest.fn();
jest.mock('./PerpsProDialogBackdrop', () => ({
  PerpsProDialogBackdrop: () => null,
}));
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: mockClose,
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          testID: 'field-explanation-bottom-sheet',
        });
      },
    ),
  };
});
jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ title, ...props }: { title: string; [key: string]: unknown }) =>
      ReactModule.createElement(
        Pressable,
        { ...props, testID: 'field-explanation-confirm' },
        ReactModule.createElement(Text, null, title),
      ),
  };
});
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: { perpsProFieldExplanation: 'field-explanation' },
  useRegisterBlockingModal: jest.fn(),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').ScrollView,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.funding.gotIt': 'I Got it',
        'page.perps.pro.fieldExplanations.liquidationDistance.description':
          'Distance explanation',
        'page.perps.pro.fieldExplanations.liquidationDistance.title':
          'Liq. Distance',
      }[key] ?? key),
  }),
}));

import { PerpsProFieldExplanationSheet } from './PerpsProFieldExplanationSheet';

describe('PerpsProFieldExplanationSheet', () => {
  it('sizes to explanation content and closes through the same button callback', () => {
    render(
      <PerpsProFieldExplanationSheet
        explanationKey="liquidationDistance"
        onDismiss={jest.fn()}
      />,
    );

    const sheet = screen.getByTestId('field-explanation-bottom-sheet');
    expect(sheet.props.snapPoints).toBeUndefined();
    expect(sheet.props.enableDynamicSizing).toBe(true);
    expect(sheet.props.maxDynamicContentSize).toBeGreaterThan(0);
    expect(sheet.props.backdropProps).toEqual({ pressBehavior: 'close' });
    expect(StyleSheet.flatten(sheet.props.handleStyle)).toMatchObject({
      height: 40,
    });
    expect(StyleSheet.flatten(sheet.props.handleIndicatorStyle)).toMatchObject({
      height: 6,
      width: 50,
    });
    expect(screen.getByText('Liq. Distance')).toBeTruthy();
    expect(screen.getByText('Distance explanation')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Distance explanation').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      marginTop: 12,
    });
    const container = screen
      .UNSAFE_getAllByType(View)
      .find(
        view => StyleSheet.flatten(view.props.style)?.paddingHorizontal === 16,
      )!;
    expect(StyleSheet.flatten(container.props.style)).toMatchObject({
      paddingHorizontal: 16,
      paddingTop: 8,
    });
    expect(StyleSheet.flatten(container.props.style).minHeight).toBeUndefined();
    expect(screen.getByText('I Got it')).toBeTruthy();
    expect(screen.getByTestId('field-explanation-confirm').props.height).toBe(
      52,
    );
    fireEvent.press(screen.getByTestId('field-explanation-confirm'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('field-explanation-confirm').props.type).toBe(
      'primary',
    );
  });
});
