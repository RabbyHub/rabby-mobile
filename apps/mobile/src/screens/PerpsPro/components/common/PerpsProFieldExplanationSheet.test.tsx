import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

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
          close: jest.fn(),
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
    Button: ({ title, type }: { title: string; type: string }) =>
      ReactModule.createElement(
        Pressable,
        { testID: 'field-explanation-confirm', type },
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
  BottomSheetView: require('react-native').View,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.confirm': 'Confirm',
        'page.perps.pro.fieldExplanations.liquidationDistance.description':
          'Distance explanation',
        'page.perps.pro.fieldExplanations.liquidationDistance.title':
          'Liq. Distance',
      }[key] ?? key),
  }),
}));

import { PerpsProFieldExplanationSheet } from './PerpsProFieldExplanationSheet';

describe('PerpsProFieldExplanationSheet', () => {
  it('matches the approved 290px explanation sheet contract', () => {
    render(
      <PerpsProFieldExplanationSheet
        explanationKey="liquidationDistance"
        onDismiss={jest.fn()}
      />,
    );

    const sheet = screen.getByTestId('field-explanation-bottom-sheet');
    expect(sheet.props.snapPoints).toEqual([290]);
    expect(sheet.props.enableDynamicSizing).toBe(false);
    expect(sheet.props.backdropProps).toEqual({ pressBehavior: 'close' });
    expect(StyleSheet.flatten(sheet.props.handleStyle)).toMatchObject({
      height: 40,
    });
    expect(StyleSheet.flatten(sheet.props.handleIndicatorStyle)).toMatchObject({
      height: 4,
      width: 40,
    });
    expect(screen.getByText('Liq. Distance')).toBeTruthy();
    expect(screen.getByText('Distance explanation')).toBeTruthy();
    expect(screen.getByTestId('field-explanation-confirm').props.type).toBe(
      'primary',
    );
  });
});
