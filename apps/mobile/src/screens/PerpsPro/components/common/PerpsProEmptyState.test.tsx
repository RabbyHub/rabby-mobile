import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

let mockIsLight = true;

jest.mock('@/assets2024/singleHome/empty-token.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/singleHome/empty-token-dark.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

import { PerpsProEmptyState } from './PerpsProEmptyState';

describe('PerpsProEmptyState', () => {
  beforeEach(() => {
    mockIsLight = true;
  });

  it('matches the approved light empty-state geometry and typography', () => {
    render(<PerpsProEmptyState message="No History" testID="empty" />);

    expect(screen.getByTestId('empty-light').props).toMatchObject({
      height: 126,
      width: 163,
    });
    expect(screen.queryByTestId('empty-dark')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('empty').props.style)).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        flex: 1,
        paddingTop: 80,
      }),
    );
    expect(
      StyleSheet.flatten(screen.getByText('No History').props.style),
    ).toEqual(
      expect.objectContaining({
        color: 'neutral-info',
        fontFamily: 'SF Pro Rounded',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
        marginTop: 12,
        textAlign: 'center',
      }),
    );
  });

  it('uses the approved dark asset in dark mode', () => {
    mockIsLight = false;
    render(<PerpsProEmptyState message="No open orders" testID="empty" />);

    expect(screen.getByTestId('empty-dark').props).toMatchObject({
      height: 126,
      width: 163,
    });
    expect(screen.queryByTestId('empty-light')).toBeNull();
  });
});
