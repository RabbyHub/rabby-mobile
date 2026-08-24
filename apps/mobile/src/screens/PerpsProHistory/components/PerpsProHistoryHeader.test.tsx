import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/core/utils/fonts', () => ({
  FontNames: { sf_pro: 'SF Pro' },
}));

jest.mock('@/hooks/navigation', () => ({
  HeaderBackPressable: (props: object) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, {
      ...props,
      testID: 'history-header-back',
    });
  },
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));

import {
  PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT,
  PerpsProHistoryHeader,
} from './PerpsProHistoryHeader';

describe('PerpsProHistoryHeader', () => {
  it('keeps a 56px content area below the safe area and matches typography', () => {
    render(<PerpsProHistoryHeader title="Trade History" />);

    const title = screen.getByText('Trade History');
    const views = screen.UNSAFE_getAllByType(View);
    const outer = views.find(
      view =>
        StyleSheet.flatten(view.props.style)?.height ===
        47 + PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT,
    )!;
    const content = views.find(
      view =>
        StyleSheet.flatten(view.props.style)?.height ===
          PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT &&
        StyleSheet.flatten(view.props.style)?.position === 'relative',
    )!;

    expect(StyleSheet.flatten(outer.props.style)).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      height: 47 + PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT,
      paddingTop: 47,
    });
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      height: 56,
      position: 'relative',
    });
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      color: 'neutral-title-1',
      fontFamily: 'SF Pro',
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 22,
      textAlign: 'center',
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('history-header-back').props.style),
    ).toMatchObject({
      left: 16,
      marginLeft: 0,
      paddingLeft: 0,
      position: 'absolute',
      top: 16,
    });
  });
});
