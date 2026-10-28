import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DetailAddressText, splitAddressInTwoLines } from './DetailAddressText';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));

// Digit-heavy address that wrapped onto a third line at the old 170pt width.
const ADDRESS = '0x07964f135f276412b3182a3b2407b8dd45000000';

describe('splitAddressInTwoLines', () => {
  it('splits a 42-char address into two 21-char halves', () => {
    expect(splitAddressInTwoLines(ADDRESS)).toBe(
      '0x07964f135f276412b31\n82a3b2407b8dd45000000',
    );
  });

  it('leaves other lengths untouched', () => {
    expect(splitAddressInTwoLines('')).toBe('');
    expect(splitAddressInTwoLines('0x07964f')).toBe('0x07964f');
  });
});

describe('DetailAddressText', () => {
  it('renders the split address', () => {
    render(<DetailAddressText address={ADDRESS} />);

    expect(
      screen.getByText('0x07964f135f276412b31\n82a3b2407b8dd45000000'),
    ).toBeTruthy();
  });
});
