import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PerpsProSkeletonBlock } from './PerpsProSkeletonBlock';

jest.mock('@/components2024/CustomSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    CustomSkeleton: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'custom-skeleton',
      }),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({
      colors2024: {
        'neutral-info': '#c5c5cf',
      },
    }),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

describe('PerpsProSkeletonBlock', () => {
  it('keeps one pulse animation and uses a visible token-backed base', () => {
    render(
      <PerpsProSkeletonBlock
        height={8}
        style={{ borderRadius: 4 }}
        width={24}
      />,
    );

    const skeleton = screen.getByTestId('custom-skeleton');
    expect(skeleton.props.animation).toBe('none');
    expect(StyleSheet.flatten(skeleton.props.style)).toMatchObject({
      backgroundColor: '#c5c5cf',
      borderRadius: 4,
    });
  });
});
