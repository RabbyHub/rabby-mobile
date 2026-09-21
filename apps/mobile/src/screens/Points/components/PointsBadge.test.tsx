import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { PointsBadge } from './PointsBadge';

const mockUsePointsBadge = jest.fn();
const mockFormatTokenAmount = jest.fn();

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {
      text: {
        color: '#999',
      },
    },
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => ({
    getStyles: () => ({}),
    getReanimatedStyles: {},
  }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('../hooks', () => ({
  usePointsBadge: () => mockUsePointsBadge(),
}));

jest.mock('@/utils/number', () => ({
  formatTokenAmount: (value: number) => mockFormatTokenAmount(value),
}));

describe('PointsBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when badge is undefined', () => {
    mockUsePointsBadge.mockReturnValue(undefined);

    const { toJSON } = render(<PointsBadge />);

    expect(toJSON()).toBeNull();
  });

  it('also renders nothing when badge is 0', () => {
    mockUsePointsBadge.mockReturnValue(0);

    const { toJSON } = render(<PointsBadge />);

    expect(toJSON()).toBeNull();
    expect(mockFormatTokenAmount).not.toHaveBeenCalled();
  });

  it('renders formatted badge text when badge exists', () => {
    mockUsePointsBadge.mockReturnValue(1234);
    mockFormatTokenAmount.mockReturnValue('1,234');

    render(<PointsBadge />);

    expect(mockFormatTokenAmount).toHaveBeenCalledWith(1234);
    expect(screen.getByText('1,234')).toBeTruthy();
  });
});
