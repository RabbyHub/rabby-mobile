import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'jotai';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  useHideTipsPopup,
  useShowTipsPopup,
  useTipsPopup,
} from '@/hooks/useTipsPopup';

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
    Button: (props: Record<string, unknown>) =>
      ReactModule.createElement(NativePressable, {
        ...props,
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
          bgType: 'bg0',
          buttonType: 'hyperliquid',
          buttonTitle: 'I Got It',
          retainContentOnClose: true,
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

const StateProbe = () => {
  const { state } = useTipsPopup();
  return (
    <Text testID="tips-state">{`${state.visible}:${state.owner ?? ''}:${
      state.title
    }`}</Text>
  );
};

const renderLifecycle = () =>
  render(
    <Provider>
      <PortfolioTipsTrigger />
      <OtherTipsTrigger />
      <PortfolioTipsDismissTrigger />
      <StateProbe />
      <GlobalTipsPopup />
    </Provider>,
  );

const modalProps = () => mockModalProps.mock.calls.at(-1)![0];

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

  it.each(['tips-close-button', 'dismiss-portfolio-tips'])(
    'keeps the opted-in presentation through dismissal from %s',
    trigger => {
      renderLifecycle();
      fireEvent.press(screen.getByTestId('show-portfolio-tips'));
      fireEvent.press(screen.getByTestId(trigger));

      expect(screen.getByTestId('tips-state')).toHaveTextContent('false::');
      expect(screen.getByText('Portfolio breakdown')).toBeTruthy();
      expect(screen.getByTestId('tips-close-button').props).toMatchObject({
        type: 'hyperliquid',
        title: 'I Got It',
      });
      expect(modalProps().enablePanDownToClose).toBe(true);

      act(() => modalProps().onDismiss());
      expect(screen.queryByText('Portfolio breakdown')).toBeNull();
      fireEvent.press(screen.getByTestId('show-portfolio-tips'));
      expect(screen.getByTestId('tips-state')).toHaveTextContent(
        'true:perps-portfolio-breakdown:Portfolio Margin',
      );
      expect(mockPresent).toHaveBeenCalledTimes(2);
    },
  );

  it('clears the active owner after a native gesture/backdrop dismissal', () => {
    renderLifecycle();
    fireEvent.press(screen.getByTestId('show-portfolio-tips'));
    act(() => modalProps().onAnimate(0, -1));
    expect(screen.getByText('Portfolio breakdown')).toBeTruthy();
    act(() => modalProps().onDismiss());
    expect(screen.getByTestId('tips-state')).toHaveTextContent('false::');
    expect(screen.queryByText('Portfolio breakdown')).toBeNull();
  });

  it.each(['button', 'gesture'])(
    'preserves a newer popup opened during %s dismissal',
    method => {
      renderLifecycle();
      fireEvent.press(screen.getByTestId('show-portfolio-tips'));
      if (method === 'button') {
        fireEvent.press(screen.getByTestId('tips-close-button'));
      } else {
        act(() => modalProps().onAnimate(0, -1));
      }
      fireEvent.press(screen.getByTestId('show-other-tips'));
      expect(screen.getByText('Portfolio breakdown')).toBeTruthy();
      expect(mockPresent).toHaveBeenCalledTimes(1);
      // Repeated presses on the exiting button must not clear the queued popup.
      fireEvent.press(screen.getByTestId('tips-close-button'));
      expect(screen.getByTestId('tips-state')).toHaveTextContent(
        'true:other-owner:Other popup',
      );
      act(() => modalProps().onDismiss());
      expect(screen.getByTestId('tips-state')).toHaveTextContent(
        'true:other-owner:Other popup',
      );
      expect(screen.queryByText('Portfolio breakdown')).toBeNull();
      expect(screen.getByTestId('tips-close-button').props).toMatchObject({
        type: 'primary',
        title: 'component.GlobalTipsPopup.btn',
      });
      expect(mockPresent).toHaveBeenCalledTimes(2);
    },
  );

  it('retains a newly opened opted-in popup on its subsequent close', () => {
    renderLifecycle();
    fireEvent.press(screen.getByTestId('show-portfolio-tips'));
    fireEvent.press(screen.getByTestId('tips-close-button'));
    fireEvent.press(screen.getByTestId('show-portfolio-tips'));
    act(() => modalProps().onDismiss());
    expect(screen.getByTestId('tips-state')).toHaveTextContent(
      'true:perps-portfolio-breakdown:Portfolio Margin',
    );
    fireEvent.press(screen.getByTestId('tips-close-button'));
    expect(screen.getByText('Portfolio breakdown')).toBeTruthy();
    expect(screen.getByTestId('tips-close-button').props.type).toBe(
      'hyperliquid',
    );
    act(() => modalProps().onDismiss());
    expect(screen.queryByText('Portfolio breakdown')).toBeNull();
  });

  it('keeps immediate clearing and the default title for other callers', () => {
    renderLifecycle();
    fireEvent.press(screen.getByTestId('show-other-tips'));
    fireEvent.press(screen.getByTestId('tips-close-button'));
    expect(screen.getByTestId('tips-state')).toHaveTextContent('false::');
    expect(screen.queryByText('Other popup')).toBeNull();
    expect(screen.getByTestId('tips-close-button').props.title).toBe(
      'component.GlobalTipsPopup.btn',
    );
  });
});
