import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

import { AppStackHeader, renderAppStackHeader } from './AppStackHeader';

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any = {}) => {
    const { ThemeColors, ThemeColors2024 } = require('@/constant/theme');
    const theme = {
      colors: ThemeColors.light,
      colors2024: ThemeColors2024.light,
      isLight: true,
      windowWidth: 390,
      language: 'en-US',
    };
    return { ...theme, styles: getStyle ? getStyle(theme) : {} };
  },
}));

jest.mock('@/hooks/useAppLayout', () => ({
  useCustomHeaderTop: () => 0,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The Duo outer screen: a 84pt system column on the right.
jest.mock('@/components/SafeWindowFrame/backdrop', () => ({
  useSystemColumnInset: () => ({ left: 0, right: 84 }),
}));

jest.mock('@/hooks/navigation', () => ({
  HeaderBackButton: () => {
    const { View } = require('react-native');
    return <View testID="header-back" />;
  },
}));

jest.mock('@/components/AutoFitHeaderTitle', () => ({
  AutoFitHeaderTitle: ({ text }: { text: string }) => {
    const { Text } = require('react-native');
    return <Text>{text}</Text>;
  },
}));

jest.mock('@/components/headerTitleTypography', () => ({
  resolveHeaderTitleLanguageStyle: () => ({}),
}));

jest.mock('@/core/native/utils', () => ({ IS_IOS: true }));

jest.mock('@/constant/layout', () => ({
  ScreenLayouts: { headerAreaHeight: 56 },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: Function) => getStyle,
}));

function collectStyles(node: any, out: any[] = []) {
  if (!node || typeof node !== 'object') {
    return out;
  }
  if (node.props && node.props.style) {
    const styles = Array.isArray(node.props.style)
      ? node.props.style
      : [node.props.style];
    styles.forEach(
      style => style && Object.keys(style).length && out.push(style),
    );
  }
  (node.children || []).forEach((child: any) => collectStyles(child, out));
  return out;
}

describe('AppStackHeader', () => {
  it('renders the auto-fit title inside the content column', () => {
    const json = render(<AppStackHeader title="Delete Wallet" />).toJSON();

    expect(screen.getByText('Delete Wallet')).toBeTruthy();
    // The foldable column inset is owned by the header row, not the page.
    const styles = collectStyles(json);
    expect(
      styles.some(
        style => style.paddingRight === 16 + 84 && style.paddingLeft === 16,
      ),
    ).toBe(true);
  });

  it('keeps the leading slot but drops the control when back is false', () => {
    const withBack = render(<AppStackHeader title="Import" />);
    expect(withBack.queryByTestId('header-back')).toBeTruthy();
    withBack.unmount();

    const noBack = render(<AppStackHeader title="Import" back={false} />);
    expect(noBack.queryByTestId('header-back')).toBeNull();
  });

  it('renders a trailing action in the fixed trailing slot', () => {
    const { Text } = require('react-native');
    render(<AppStackHeader title="Transactions" right={<Text>filter</Text>} />);

    expect(screen.getByText('filter')).toBeTruthy();
  });

  it('derives back from navigation.canGoBack() for route-level headers', () => {
    const makeProps = (canGoBack: boolean) =>
      ({
        route: { key: 'fixture', name: 'Fixture' },
        navigation: { canGoBack: () => canGoBack },
        options: {},
      } as unknown as NativeStackHeaderProps);

    const Root = renderAppStackHeader({ title: 'Root' });
    const rootView = render(<>{Root(makeProps(false))}</>);
    expect(rootView.queryByTestId('header-back')).toBeNull();
    rootView.unmount();

    const Child = renderAppStackHeader(() => ({ title: 'Child' }));
    const childView = render(<>{Child(makeProps(true))}</>);
    expect(childView.queryByTestId('header-back')).toBeTruthy();
  });
});
