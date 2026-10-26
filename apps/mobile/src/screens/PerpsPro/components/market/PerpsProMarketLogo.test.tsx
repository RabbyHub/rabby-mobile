import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components/AssetAvatar', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    DefaultToken: () =>
      ReactModule.createElement(View, {
        testID: 'default-token',
      }),
  };
});

jest.mock('react-native-fast-image', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => ReactModule.createElement(View, props),
  };
});

const {
  PerpsProMarketLogo,
}: typeof import('./PerpsProMarketLogo') = require('./PerpsProMarketLogo');

describe('PerpsProMarketLogo', () => {
  it('ignores a previous market failure after the physical slot is rebound', () => {
    const { rerender } = render(
      <PerpsProMarketLogo
        isLight
        logoUrl="https://example.test/alpha.png"
        marketKey="hyperliquid::ALPHA"
        size={46}
      />,
    );
    const alphaError = screen.getByTestId('perps-pro-market-logo-image').props
      .onError;

    rerender(
      <PerpsProMarketLogo
        isLight
        logoUrl="https://example.test/beta.png"
        marketKey="hyperliquid::BETA"
        size={46}
      />,
    );
    act(() => {
      alphaError();
    });

    expect(screen.getByTestId('perps-pro-market-logo-image')).toBeTruthy();
    expect(screen.queryByTestId('default-token')).toBeNull();

    act(() => {
      screen.getByTestId('perps-pro-market-logo-image').props.onError();
    });
    expect(screen.getByTestId('default-token')).toBeTruthy();
  });

  it('uses the existing fallback for missing and remote SVG logos', () => {
    const { rerender } = render(
      <PerpsProMarketLogo
        isLight={false}
        logoUrl=""
        marketKey="hyperliquid::EMPTY"
        size={46}
      />,
    );
    expect(screen.getByTestId('default-token')).toBeTruthy();

    rerender(
      <PerpsProMarketLogo
        isLight={false}
        logoUrl="https://example.test/vector.svg?version=1"
        marketKey="hyperliquid::SVG"
        size={46}
      />,
    );
    expect(screen.getByTestId('default-token')).toBeTruthy();
  });
});
