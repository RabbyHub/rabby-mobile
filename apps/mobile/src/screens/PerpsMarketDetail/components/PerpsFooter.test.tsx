import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PerpsFooter } from './PerpsFooter';

jest.mock('@/core/native/utils', () => ({
  ...jest.requireActual('@/core/native/utils'),
  IS_ANDROID: true,
  IS_IOS: false,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (value: number) => value,
}));
jest.mock(
  '@/assets2024/icons/swap/loading-cc.svg',
  () => require('react-native').View,
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any = {}) => {
    const context = {
      colors2024: require('@/constant/theme').ThemeColors2024.light,
      isLight: true,
      safeAreaInsets: { bottom: 0 },
    };
    return { ...context, styles: getStyle?.getStyles(context) };
  },
}));

it('clears Button lineHeight after real theme normalization, including single Close', () => {
  const view = render(<PerpsFooter hasPermission />);
  for (const title of ['long', 'short']) {
    const style = StyleSheet.flatten(
      view.getByText(`page.perpsDetail.action.${title}`).props.style,
    );
    expect(style).toMatchObject({
      height: 46,
      paddingVertical: 0,
      includeFontPadding: false,
      textAlignVertical: 'center',
    });
    expect(style.lineHeight).toBeUndefined();
  }
  view.rerender(<PerpsFooter hasPosition />);
  const single = StyleSheet.flatten(
    view.getByText('page.perpsDetail.action.close').props.style,
  );
  expect(single.height).toBe(50);
  expect(single.lineHeight).toBeUndefined();
  view.rerender(<PerpsFooter />);
  expect(
    StyleSheet.flatten(
      view.getByText('page.perpsDetail.action.noPermission').props.style,
    ).lineHeight,
  ).toBe(22);
});
