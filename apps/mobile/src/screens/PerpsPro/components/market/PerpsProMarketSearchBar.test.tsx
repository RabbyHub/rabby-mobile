import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockBlur = jest.fn();
const mockFocus = jest.fn();
const mockNextSearchBarProps = jest.fn();

jest.mock('@/components2024/SearchBar', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    NextSearchBar: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        mockNextSearchBarProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          blur: mockBlur,
          focus: mockFocus,
        }));
        return ReactModule.createElement(NativeView, {
          testID: 'next-search-bar',
        });
      },
    ),
  };
});

const { PerpsProMarketSearchBar } =
  require('./PerpsProMarketSearchBar') as typeof import('./PerpsProMarketSearchBar');

const getLatestSearchProps = () =>
  mockNextSearchBarProps.mock.calls[
    mockNextSearchBarProps.mock.calls.length - 1
  ][0];

describe('PerpsProMarketSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('centers the Figma resting content and focuses through the full mask', () => {
    render(
      <PerpsProMarketSearchBar
        onChangeText={jest.fn()}
        onFocusChange={jest.fn()}
        placeholder="Search Token"
        value=""
      />,
    );

    const searchProps = getLatestSearchProps();
    expect(searchProps.as).toBe('BottomSheetTextInput');
    expect(searchProps.noCancel).toBeUndefined();
    expect(StyleSheet.flatten(searchProps.inputContainerStyle)).toEqual(
      expect.objectContaining({ justifyContent: 'center' }),
    );
    expect(StyleSheet.flatten(searchProps.inputStyle)).toEqual(
      expect.objectContaining({ flex: 0, lineHeight: 20 }),
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-search-focus-mask'));
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  it('exposes Cancel in focused mode and clears through the shared interaction', () => {
    const onChangeText = jest.fn();
    const onFocusChange = jest.fn();
    render(
      <PerpsProMarketSearchBar
        onChangeText={onChangeText}
        onFocusChange={onFocusChange}
        placeholder="Search Token"
        value=""
      />,
    );

    act(() => {
      getLatestSearchProps().onFocus();
    });
    expect(onFocusChange).toHaveBeenCalledWith(true);
    expect(
      screen.queryByTestId('perps-pro-market-search-focus-mask'),
    ).toBeNull();
    expect(getLatestSearchProps().onCancel).toEqual(expect.any(Function));

    act(() => {
      getLatestSearchProps().onCancel();
    });
    expect(onChangeText).toHaveBeenCalledWith('');

    act(() => {
      getLatestSearchProps().onBlur();
    });
    expect(onFocusChange).toHaveBeenCalledWith(false);
    expect(
      screen.getByTestId('perps-pro-market-search-focus-mask'),
    ).toBeTruthy();
  });
});
