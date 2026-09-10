import { render, screen } from '@testing-library/react-native';
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
  BottomSheetScrollView: require('react-native').ScrollView,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
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

import {
  PERPS_PRO_FIELD_EXPLANATION_MIN_HEIGHT,
  PerpsProFieldExplanationSheet,
} from './PerpsProFieldExplanationSheet';

describe('PerpsProFieldExplanationSheet', () => {
  it('uses content-driven sizing with the approved 240px minimum', () => {
    render(
      <PerpsProFieldExplanationSheet
        explanationKey="liquidationDistance"
        onDismiss={jest.fn()}
      />,
    );

    const sheet = screen.getByTestId('field-explanation-bottom-sheet');
    expect(sheet.props.snapPoints).toBeUndefined();
    expect(sheet.props.enableDynamicSizing).toBe(true);
    expect(sheet.props.maxDynamicContentSize).toBeGreaterThanOrEqual(
      PERPS_PRO_FIELD_EXPLANATION_MIN_HEIGHT,
    );
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
    expect(
      StyleSheet.flatten(screen.getByText('Distance explanation').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      marginTop: 16,
    });
    const container = screen
      .UNSAFE_getAllByType(View)
      .find(view => StyleSheet.flatten(view.props.style)?.minHeight === 200)!;
    expect(StyleSheet.flatten(container.props.style)).toMatchObject({
      minHeight: 200,
      paddingHorizontal: 15,
      paddingTop: 8,
    });
    expect(screen.getByTestId('field-explanation-confirm').props.type).toBe(
      'primary',
    );
  });
});
