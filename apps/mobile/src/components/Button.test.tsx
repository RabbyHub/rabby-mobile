import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, MiniButton, PrimaryButton } from './Button';

jest.mock('@/hooks/theme', () => ({
  useGetBinaryMode: () => 'light',
  useThemeColors: () => ({
    'blue-default': '#1677ff',
    'blue-disable': '#9ec5ff',
    'green-default': '#00aa66',
    'neutral-bg1': '#ffffff',
    'neutral-line': '#eeeeee',
    'neutral-title2': '#111111',
    'red-default': '#ff4444',
  }),
  useTheme2024: () => ({
    styles: {
      miniBtnTextView: {},
      miniBtnView: {},
    },
  }),
}));

jest.mock('@/components/Text', () => ({
  Text: require('react-native').Text,
}));

describe('Button', () => {
  it('calls onPress when enabled', () => {
    const onPress = jest.fn();

    render(<Button title="Continue" onPress={onPress} testID="button" />);

    fireEvent.press(screen.getByTestId('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('blocks onPress while loading and marks the button busy', () => {
    const onPress = jest.fn();

    render(
      <Button
        title="Continue"
        loading
        showTitleOnLoading
        onPress={onPress}
        testID="button"
      />,
    );

    fireEvent.press(screen.getByTestId('button'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true }),
    );
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('blocks onPress when disabled and marks the button disabled', () => {
    const onPress = jest.fn();

    render(
      <Button title="Continue" disabled onPress={onPress} testID="button" />,
    );

    fireEvent.press(screen.getByTestId('button'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('keeps PrimaryButton and MiniButton press behavior wired', () => {
    const primaryPress = jest.fn();
    const miniPress = jest.fn();

    render(
      <>
        <PrimaryButton
          title="Primary"
          onPress={primaryPress}
          testID="primary"
        />
        <MiniButton onPress={miniPress} testID="mini">
          Mini
        </MiniButton>
      </>,
    );

    fireEvent.press(screen.getByTestId('primary'));
    fireEvent.press(screen.getByTestId('mini'));

    expect(primaryPress).toHaveBeenCalledTimes(1);
    expect(miniPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Primary')).toBeTruthy();
    expect(screen.getByText('Mini')).toBeTruthy();
  });
});
