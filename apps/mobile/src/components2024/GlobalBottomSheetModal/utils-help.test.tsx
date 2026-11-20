import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { ThemeColors2024 } from '@/constant/theme';
import { makeBottomSheetProps } from './utils-help';
import { MODAL_NAMES } from './types';

jest.mock('./utils', () => ({}));
jest.mock('./BackgroundComponent', () => ({
  BackgroundComponent: () => null,
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const dark = ThemeColors2024.dark;
const light = ThemeColors2024.light;

function renderBackground(
  props: ReturnType<typeof makeBottomSheetProps>,
): Record<string, unknown> {
  const Background = props.backgroundComponent as React.FC<
    Partial<BottomSheetBackgroundProps>
  >;
  const { toJSON } = render(
    <Background
      pointerEvents="none"
      style={{ backgroundColor: dark['neutral-bg-1'] }}
    />,
  );
  const tree = toJSON() as { props: { style: unknown } };
  return StyleSheet.flatten(tree.props.style as any) as Record<string, unknown>;
}

describe('makeBottomSheetProps', () => {
  it.each([MODAL_NAMES.TIP_PRIVACY_POLICY, MODAL_NAMES.TIP_TERM_OF_USE])(
    'keeps the %s sheet chrome light in the dark theme',
    name => {
      const props = makeBottomSheetProps({
        colors: dark,
        createParams: { name },
      });

      expect(StyleSheet.flatten(props.handleStyle)).toMatchObject({
        backgroundColor: light['neutral-bg-1'],
        height: 36,
      });
      expect(StyleSheet.flatten(props.handleIndicatorStyle)).toMatchObject({
        backgroundColor: light['neutral-line'],
        width: 50,
      });
      expect(renderBackground(props)).toMatchObject({
        backgroundColor: light['neutral-bg-1'],
      });
    },
  );

  it('keeps the theme handle color for other sheets', () => {
    const props = makeBottomSheetProps({
      colors: dark,
      createParams: { name: MODAL_NAMES.TIP_UPGRADE },
    });

    expect(StyleSheet.flatten(props.handleStyle)).toMatchObject({
      backgroundColor: dark['neutral-bg-1'],
    });
    expect(StyleSheet.flatten(props.handleIndicatorStyle)).toMatchObject({
      backgroundColor: dark['neutral-line'],
    });
  });
});
