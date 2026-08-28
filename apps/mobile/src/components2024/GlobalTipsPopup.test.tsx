import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useHideTipsPopup, useShowTipsPopup } from '@/hooks/useTipsPopup';

import { GlobalTipsPopup } from './GlobalTipsPopup';

const mockModalProps = jest.fn();
const mockPresent = jest.fn();
const mockClose = jest.fn();

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: mockClose,
          present: mockPresent,
        }));
        mockModalProps(props);
        return ReactModule.createElement(
          NativeView,
          { testID: 'tips-bottom-sheet' },
          props.children,
        );
      },
    ),
  };
});

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable: NativePressable } = require('react-native');
  return {
    Button: ({ onPress }: { onPress: () => void }) =>
      ReactModule.createElement(NativePressable, {
        onPress,
        testID: 'tips-close-button',
      }),
  };
});

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({ sharedBottomSheetProp: true }),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
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

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    BottomSheetView: (props: Record<string, unknown>) =>
      ReactModule.createElement(NativeView, props, props.children),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const PortfolioTipsTrigger = () => {
  const showTipsPopup = useShowTipsPopup();
  return (
    <Pressable
      onPress={() =>
        showTipsPopup({
          desc: 'Portfolio breakdown',
          enablePanDownToClose: true,
          owner: 'perps-portfolio-breakdown',
          title: 'Portfolio Margin',
        })
      }
      testID="show-portfolio-tips"
    />
  );
};

const OtherTipsTrigger = () => {
  const showTipsPopup = useShowTipsPopup();
  return (
    <Pressable
      onPress={() =>
        showTipsPopup({
          desc: 'Other popup',
          owner: 'other-owner',
          title: 'Other popup',
        })
      }
      testID="show-other-tips"
    />
  );
};

const PortfolioTipsDismissTrigger = () => {
  const hideTipsPopup = useHideTipsPopup('perps-portfolio-breakdown');
  return <Pressable onPress={hideTipsPopup} testID="dismiss-portfolio-tips" />;
};

describe('GlobalTipsPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards owner-opted pan-down dismissal without changing the default', () => {
    render(
      <View>
        <PortfolioTipsTrigger />
        <GlobalTipsPopup />
      </View>,
    );

    expect(mockModalProps.mock.calls.at(-1)?.[0].enablePanDownToClose).toBe(
      undefined,
    );

    fireEvent.press(screen.getByTestId('show-portfolio-tips'));

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(mockModalProps.mock.calls.at(-1)?.[0]).toMatchObject({
      enablePanDownToClose: true,
      sharedBottomSheetProp: true,
    });

    fireEvent.press(screen.getByTestId('tips-close-button'));
    expect(mockClose).toHaveBeenCalled();
  });

  it('does not dismiss a popup owned by another feature', () => {
    render(
      <View>
        <OtherTipsTrigger />
        <PortfolioTipsDismissTrigger />
        <GlobalTipsPopup />
      </View>,
    );

    fireEvent.press(screen.getByTestId('show-other-tips'));
    expect(mockPresent).toHaveBeenCalledTimes(1);
    const closeCount = mockClose.mock.calls.length;

    fireEvent.press(screen.getByTestId('dismiss-portfolio-tips'));
    expect(mockClose).toHaveBeenCalledTimes(closeCount);
  });
});
