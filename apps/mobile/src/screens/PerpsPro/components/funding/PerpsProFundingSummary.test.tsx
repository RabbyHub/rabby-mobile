import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'page.perps.pro.funding.summary'
        ? 'Funding (1h) / Countdown'
        : key,
  }),
}));

import { PerpsProFundingSummary } from './PerpsProFundingSummary';

describe('PerpsProFundingSummary', () => {
  it('keeps the funding field on one semantic-font line', () => {
    render(
      <PerpsProFundingSummary
        market={null}
        onPress={jest.fn()}
        serverClock={null}
      />,
    );

    const label = screen.getByText('Funding (1h) / Countdown');
    expect(label.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
    });
    expect(StyleSheet.flatten(label.parent?.parent?.props.style)).toMatchObject(
      {
        flexShrink: 0,
        minWidth: 136,
      },
    );
  });
});
