import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NextSearchBar } from './index';

jest.mock('@/assets/icons/common', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const Icon = (props: object) => ReactModule.createElement(View, props);
  return {
    RcNextCloseCircle: Icon,
    RcNextCloseCircleDark: Icon,
    RcNextSearchCC: Icon,
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@/components/Typography', () => {
  const ReactNative = require('react-native');
  return {
    Text: ReactNative.Text,
    TextInput: ReactNative.TextInput,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const ReactNative = require('react-native');
  return {
    TouchableOpacity: ReactNative.TouchableOpacity,
    TouchableWithoutFeedback: ReactNative.TouchableWithoutFeedback,
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = require('react-native');
  return {
    BottomSheetTextInput: ReactNative.TextInput,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    {children}
  </SafeAreaProvider>
);

const inputLayoutEvent = {
  nativeEvent: {
    layout: { x: 39, y: 0, width: 260, height: 46 },
  },
};

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

describe('NextSearchBar managed iOS placeholder', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    setPlatform(originalOS);
  });

  it('paints a centered placeholder and hides the native one once laid out', () => {
    setPlatform('ios');
    render(
      <NextSearchBar
        testID="search"
        placeholder="搜索链"
        value=""
        onChangeText={jest.fn()}
      />,
      { wrapper },
    );

    const input = screen.getByTestId('search');
    // Until the input reports its box, the native placeholder stays visible.
    expect(input.props.placeholderTextColor).not.toBe('transparent');
    expect(screen.queryByText('搜索链')).toBeNull();

    fireEvent(input, 'layout', inputLayoutEvent);

    expect(input.props.placeholderTextColor).toBe('transparent');
    const managed = screen.getByText('搜索链', { includeHiddenElements: true });
    expect(managed.props.numberOfLines).toBe(1);
  });

  it('keeps the native placeholder once the input has a value', () => {
    setPlatform('ios');
    render(
      <NextSearchBar
        testID="search"
        placeholder="搜索链"
        value="ethereum"
        onChangeText={jest.fn()}
      />,
      { wrapper },
    );

    const input = screen.getByTestId('search');
    fireEvent(input, 'layout', inputLayoutEvent);

    expect(input.props.placeholderTextColor).not.toBe('transparent');
    expect(screen.queryByText('搜索链')).toBeNull();
  });

  it('keeps the native placeholder on Android', () => {
    setPlatform('android');
    render(
      <NextSearchBar
        testID="search"
        placeholder="搜索链"
        value=""
        onChangeText={jest.fn()}
      />,
      { wrapper },
    );

    const input = screen.getByTestId('search');
    fireEvent(input, 'layout', inputLayoutEvent);

    expect(input.props.placeholderTextColor).not.toBe('transparent');
    expect(screen.queryByText('搜索链')).toBeNull();
  });
});
