import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components2024/Button', () => ({
  Button: ({ title }: { title: string }) =>
    require('react').createElement(require('react-native').Text, null, title),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@/screens/Perps/components/PerpsSkeletonLoader', () => ({
  PerpsSkeletonGradient: () => null,
}));

jest.mock('@rneui/themed', () => ({
  Skeleton: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'footer-button-skeleton',
    }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

import { PerpsFooter } from './PerpsFooter';

describe('PerpsFooter', () => {
  it('renders button skeletons until the position state is resolved', () => {
    const { rerender } = render(
      <PerpsFooter hasPermission hasPosition={false} loading />,
    );

    expect(screen.getAllByTestId('footer-button-skeleton')).toHaveLength(2);
    expect(screen.queryByText('long')).toBeNull();
    expect(screen.queryByText('short')).toBeNull();

    rerender(<PerpsFooter hasPermission hasPosition loading={false} />);
    expect(screen.queryByTestId('footer-button-skeleton')).toBeNull();
    expect(screen.getByText('add')).toBeTruthy();
    expect(screen.getByText('close')).toBeTruthy();
  });
});
