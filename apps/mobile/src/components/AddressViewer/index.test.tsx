import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';

import { ellipsisAddress } from '@/utils/address';
import { AddressViewer } from './index';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => ({
    'neutral-foot': '#999999',
  }),
}));

jest.mock('@/assets/icons/common/arrow-down-gray.svg', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockArrow() {
    return <Text testID="address-viewer-arrow">arrow</Text>;
  };
});

describe('AddressViewer', () => {
  const address = '0x1234567890ABCDEF1234567890ABCDEF12345678';

  it('lowercases and ellipsizes the address by default', () => {
    render(<AddressViewer address={address} />);

    expect(
      screen.getByText(ellipsisAddress(address.toLowerCase())),
    ).toBeTruthy();
    expect(screen.getByTestId('address-viewer-arrow')).toBeTruthy();
  });

  it('can render full address with index and no arrow', () => {
    render(
      <AddressViewer
        address={address}
        ellipsis={false}
        showArrow={false}
        showIndex
        index={3}
      />,
    );

    expect(screen.getByText(address.toLowerCase())).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByTestId('address-viewer-arrow')).toBeNull();
  });

  it('honors disabledPress', () => {
    const onClick = jest.fn();
    const { UNSAFE_getByType, rerender } = render(
      <AddressViewer address={address} onClick={onClick} disabledPress />,
    );

    expect(UNSAFE_getByType(TouchableOpacity).props.disabled).toBe(true);

    rerender(
      <AddressViewer
        address={address}
        onClick={onClick}
        disabledPress={false}
      />,
    );
    expect(UNSAFE_getByType(TouchableOpacity).props.disabled).toBe(false);
    expect(onClick).not.toHaveBeenCalled();

    rerender(<AddressViewer address={address} onClick={onClick} />);
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
