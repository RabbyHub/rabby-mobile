import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PillsSwitch } from './index';

jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => ({
    'blue-default': '#1677ff',
    'neutral-bg-1': '#ffffff',
    'neutral-body': '#333333',
    'neutral-line': '#eeeeee',
  }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').TouchableOpacity,
}));

describe('PillsSwitch', () => {
  const options = [
    { key: 'tokens', label: 'Tokens' },
    { key: 'nfts', label: 'NFTs' },
  ] as const;

  it('renders every option label', () => {
    render(<PillsSwitch options={options} value="tokens" />);

    expect(screen.getByText('Tokens')).toBeTruthy();
    expect(screen.getByText('NFTs')).toBeTruthy();
  });

  it('calls onTabChange with the selected option key', () => {
    const onTabChange = jest.fn();
    render(
      <PillsSwitch
        options={options}
        value="tokens"
        onTabChange={onTabChange}
      />,
    );

    fireEvent.press(screen.getByText('NFTs'));

    expect(onTabChange).toHaveBeenCalledWith('nfts');
  });

  it('supports an empty option list without rendering labels', () => {
    const { toJSON } = render(<PillsSwitch options={[]} />);

    expect(toJSON()).toBeTruthy();
    expect(screen.queryByText('Tokens')).toBeNull();
  });
});
