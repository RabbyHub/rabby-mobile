import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import {
  PERPS_REGION_ALERT_DEFAULT_BOTTOM_SPACING,
  PERPS_REGION_ALERT_HEADER_SPACING,
  PerpsRegionAlert,
} from './PerpsRegionAlert';

jest.mock('@/assets2024/icons/common', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    RcIconWarningCC: (props: object) =>
      ReactModule.createElement(View, { ...props, testID: 'warning-icon' }),
  };
});

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
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('PerpsRegionAlert', () => {
  it('keeps the existing bottom spacing by default', () => {
    render(<PerpsRegionAlert />);

    expect(
      StyleSheet.flatten(screen.getByTestId('perps-region-alert').props.style),
    ).toMatchObject({
      marginBottom: PERPS_REGION_ALERT_DEFAULT_BOTTOM_SPACING,
    });
  });

  it('allows Pro to opt into compact bottom spacing', () => {
    render(<PerpsRegionAlert bottomSpacing={4} />);

    expect(
      StyleSheet.flatten(screen.getByTestId('perps-region-alert').props.style),
    ).toMatchObject({ marginBottom: 4 });
  });

  it('keeps top spacing opt-in and supports the shared Perps mode gap', () => {
    const view = render(<PerpsRegionAlert />);
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-region-alert').props.style),
    ).toMatchObject({ marginTop: 0 });

    view.rerender(
      <PerpsRegionAlert topSpacing={PERPS_REGION_ALERT_HEADER_SPACING} />,
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-region-alert').props.style),
    ).toMatchObject({ marginTop: 8 });
  });

  it('constrains long text inside the padded background without truncation', () => {
    render(<PerpsRegionAlert />);

    expect(
      StyleSheet.flatten(screen.getByTestId('perps-region-alert').props.style),
    ).toMatchObject({
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      marginHorizontal: 16,
      padding: 8,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('warning-icon').props.style),
    ).toMatchObject({ flexShrink: 0 });
    expect(screen.getByTestId('warning-icon').props).toMatchObject({
      height: 18,
      width: 18,
    });

    const message = screen.getByText('page.perps.regionNotSupport');
    expect(StyleSheet.flatten(message.props.style)).toMatchObject({
      flexShrink: 1,
      lineHeight: 18,
      minWidth: 0,
    });
    expect(message.props.numberOfLines).toBeUndefined();
  });

  it('reports the colored background layout to its page owner', () => {
    const onLayout = jest.fn();
    render(<PerpsRegionAlert onLayout={onLayout} />);
    const event = {
      nativeEvent: { layout: { height: 52, width: 361, x: 16, y: 56 } },
    };

    fireEvent(screen.getByTestId('perps-region-alert'), 'layout', event);

    expect(onLayout).toHaveBeenCalledWith(event);
  });
});
