import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { HistoryHeaderTitle } from './HistoryHeaderTitle';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => ({
    styles: getStyle.getStyles({
      colors2024: { 'neutral-title-1': '#ffffff' },
    }),
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyles: unknown) => ({ getStyles }),
}));

// Layout contract, not a native glyph/rasterization assertion.
describe('history detail title font metrics', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it.each(['已兑换', 'Swapped'])(
    'lets Android use fallback font metrics for %s',
    title => {
      Platform.OS = 'android';
      const view = render(<HistoryHeaderTitle>{title}</HistoryHeaderTitle>);
      const text = view.getByText(title);
      const style = StyleSheet.flatten(text.props.style);
      expect(style.lineHeight).toBeUndefined();
      expect(style).toMatchObject({ fontSize: 20, fontWeight: '900' });
      expect(text.props.numberOfLines).toBe(1);
    },
  );

  it('preserves the iOS title line box', () => {
    Platform.OS = 'ios';
    const view = render(<HistoryHeaderTitle>已兑换</HistoryHeaderTitle>);
    expect(
      StyleSheet.flatten(view.getByText('已兑换').props.style).lineHeight,
    ).toBe(24);
  });
});
