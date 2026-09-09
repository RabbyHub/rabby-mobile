import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import fs from 'fs';
import path from 'path';

let mockIsLight = true;

jest.mock('@/assets2024/icons/perps/PerpsProEmptyLight.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testUri: 'assets2024/icons/perps/PerpsProEmptyLight.svg',
    });
});

jest.mock('@/assets2024/icons/perps/PerpsProEmptyDark.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testUri: 'assets2024/icons/perps/PerpsProEmptyDark.svg',
    });
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
    render(
      <PerpsProEmptyState message="You have no positions" testID="empty" />,
    );

    expect(screen.getByTestId('empty-illustration').props).toMatchObject({
      accessible: false,
      height: 126,
      testUri: 'assets2024/icons/perps/PerpsProEmptyLight.svg',
      width: 163,
    });
    expect(StyleSheet.flatten(screen.getByTestId('empty').props.style)).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        flex: 1,
        paddingTop: 80,
      }),
    );
    expect(
      StyleSheet.flatten(screen.getByText('You have no positions').props.style),
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

  it('uses the approved independent dark illustration', () => {
    mockIsLight = false;
    render(<PerpsProEmptyState message="No open orders" testID="empty" />);

    expect(screen.getByTestId('empty-illustration').props).toMatchObject({
      accessible: false,
      height: 126,
      testUri: 'assets2024/icons/perps/PerpsProEmptyDark.svg',
      width: 163,
    });
    expect(screen.getByText('No open orders')).toBeTruthy();
  });

  it.each([
    'PerpsProEmptyLight',
    'PerpsProEmptyDark',
    'PerpsProHistoryEmptyDark',
  ])('keeps %s entirely vector with portable opaque clipping masks', asset => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../assets2024/icons/perps',
        `${asset}.svg`,
      ),
      'utf8',
    );
    expect(source).toContain('viewBox="0 0 163 126"');
    expect(source).not.toMatch(
      /foreignObject|backdrop-filter|<image|data:image|<filter/,
    );
    const masks = source.match(/<mask\b[^>]*>[\s\S]*?<\/mask>/g) ?? [];
    expect(masks.length).toBeGreaterThan(0);
    masks.forEach(mask => {
      expect(mask).toContain('fill="white"');
      expect(mask).not.toContain('url(#frosted-');
    });
  });
});
