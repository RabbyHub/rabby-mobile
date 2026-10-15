import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { openExternalUrl } from '@/core/utils/linking';
import { PerpsSimpleChartSource } from './PerpsSimpleChartSource';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import languages from '@/assets/locales/index.json';

let mockSource = 'Charts by <tradingview>TradingView.</tradingview>';
let mockLanguage = 'en';
let mockSetLanguage: (language: string) => void;
jest.mock('@/core/utils/linking', () => ({ openExternalUrl: jest.fn() }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => ({
    styles: getStyle.getStyles({
      colors2024: require('@/constant/theme').ThemeColors2024.light,
    }),
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => {
    const [language, setLanguage] = require('react').useState(mockLanguage);
    mockSetLanguage = setLanguage;
    return { i18n: { language } };
  },
  Trans: ({ components }: any) => {
    const ReactModule = require('react');
    const [before, link, after] = mockSource.split(/<\/?tradingview>/);
    return (
      <>
        {before}
        {ReactModule.cloneElement(components.tradingview, {}, link)}
        {after}
      </>
    );
  },
}));

it.each(languages)(
  'only links the brand in $code, preserving punctuation and ordinary text',
  ({ code }) => {
    jest.mocked(openExternalUrl).mockClear();
    const locale = code === 'en-US' ? 'en' : code;
    mockSource = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../assets/locales',
          locale,
          'messages.json',
        ),
        'utf8',
      ),
    ).page.perpsDetail.simpleChart.source;
    const view = render(<PerpsSimpleChartSource />);
    fireEvent.press(
      view.getByText(mockSource.replace(/<\/?tradingview>/g, '')),
    );
    expect(openExternalUrl).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('link'));
    expect(openExternalUrl).toHaveBeenCalledWith('https://www.tradingview.com');
    expect(view.getByRole('link').props.children).toBe('TradingView');
  },
);

it('measures a link in the middle of a translated line and keeps adjacent lines out of its target', () => {
  mockLanguage = 'ja';
  mockSource = '前置説明<tradingview>TradingView</tradingview>によるチャート';
  const view = render(<PerpsSimpleChartSource />);
  const paragraph = view
    .UNSAFE_getAllByType(Text)
    .find(node => node.props.onTextLayout)!;
  const line = (text: string, y: number, width: number) => ({
    text,
    y,
    x: 20,
    width,
    height: 16,
  });
  fireEvent(paragraph, 'textLayout', {
    nativeEvent: {
      lines: [
        line('前置説明', 0, 48),
        line('TradingViewによるチャート', 16, 180),
      ],
    },
  });
  const measure = view
    .UNSAFE_getAllByType(Text)
    .find(
      node => node.props.children === 'TradingView' && node.props.onTextLayout,
    )!;
  fireEvent(measure, 'textLayout', { nativeEvent: { lines: [{ width: 70 }] } });
  expect(
    StyleSheet.flatten(
      view.getByTestId('simple-chart-source-link-target').props.style,
    ),
  ).toMatchObject({ left: 20, top: 32, width: 74, height: 24 });
  mockSource = 'Charts by <tradingview>TradingView.</tradingview>';
  act(() => mockSetLanguage('en'));
  expect(view.queryByTestId('simple-chart-source-link-target')).toBeNull();
});
