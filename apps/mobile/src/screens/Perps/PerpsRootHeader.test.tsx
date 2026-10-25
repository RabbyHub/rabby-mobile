import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet, View as RNView } from 'react-native';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';

import { PerpsRootHeader } from './PerpsRootHeader';
import {
  PerpsProRootHeaderWash,
  usePerpsRootHeaderPresentation,
} from './PerpsRootHeaderPresentation';
import { PERPS_HEADER_HEIGHT as H } from '../PerpsShared/constants';

const mockSetPopup = jest.fn();
const mockAlias = jest.fn(() => 'Wallet');
let mockIsLight = true;
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    isLight: mockIsLight,
    colors2024: { 'neutral-bg-1': mockIsLight ? '#ffffff' : '#131416' },
  }),
}));
jest.mock('@/core/apis', () => ({
  apiContact: { getAliasName: (...args: unknown[]) => mockAlias(...args) },
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeTop: 24 }),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentPerpsAccount: {
        address: '0x1234567890123456789012345678901234567890',
        aliasName: 'Wallet',
        brandName: 'Rabby',
      },
    }),
}));
jest.mock('./hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [{ isShowLoginPopup: false }, mockSetPopup],
}));
jest.mock('../PerpsShared/components/PerpsHeader', () => {
  const ReactModule = require('react');
  const { View, Pressable } = require('react-native');
  return {
    PerpsHeader: (props: {
      activeMode: string;
      onSelectMode: (mode: string) => void;
      onPressInMode: (mode: string) => void;
      onPressOutMode: (mode: string) => void;
      onPressAccount: () => void;
      transparentBackground: boolean;
      pagerUI?: RootScenePagerUI;
      navigationEnabled?: boolean;
      businessControlsEnabled?: boolean;
    }) =>
      ReactModule.createElement(
        View,
        {
          testID: 'shared-header',
          accessibilityLabel: props.activeMode,
          pagerUI: props.pagerUI,
          navigationEnabled: props.navigationEnabled,
          businessControlsEnabled: props.businessControlsEnabled,
          style: {
            backgroundColor: props.transparentBackground
              ? 'transparent'
              : 'red',
          },
        },
        ...['simple', 'pro'].map(mode =>
          ReactModule.createElement(Pressable, {
            key: mode,
            testID: `mode-${mode}`,
            onPress: () => {
              if (props.pagerUI) {
                if (props.navigationEnabled) {
                  props.pagerUI.select(mode === 'simple' ? 0 : 1);
                }
              } else {
                props.onSelectMode(mode);
              }
            },
            onPressIn: () => props.onPressInMode?.(mode),
            onPressOut: () => props.onPressOutMode?.(mode),
          }),
        ),
        ReactModule.createElement(Pressable, {
          testID: 'account',
          onPress: props.onPressAccount,
        }),
      ),
  };
});

function HeaderHarness({
  nativeScrollY,
  ...props
}: Omit<React.ComponentProps<typeof PerpsRootHeader>, 'animatedStyle'> & {
  nativeScrollY: Animated.Value;
}) {
  const presentation = usePerpsRootHeaderPresentation(
    nativeScrollY,
    props.activeMode,
  );
  return (
    <>
      <RNView testID="pro-page">
        <PerpsProRootHeaderWash animatedStyle={presentation.backdropStyle} />
      </RNView>
      <RNView testID="overlay">
        <PerpsRootHeader {...props} animatedStyle={presentation.headerStyle} />
      </RNView>
    </>
  );
}

describe('shared Perps Root header', () => {
  const select = jest.fn();
  const pressIn = jest.fn();
  const pressOut = jest.fn();
  const props = (clock: Animated.Value, mode: 'simple' | 'pro') => ({
    nativeScrollY: clock,
    activeMode: mode,
    interactive: true,
    onSelectMode: select,
    onPressInPro: pressIn,
    onPressOutPro: pressOut,
  });
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLight = true;
  });

  it.each(['simple', 'pro'] as const)(
    'keeps %s geometry on the native vertical clock with no horizontal transform',
    mode => {
      const clock = new Animated.Value(0);
      const listen = jest.spyOn(clock, 'addListener');
      const screen = render(<HeaderHarness {...props(clock, mode)} />);
      expect(listen).not.toHaveBeenCalled();
      expect(screen.getByTestId('perps-root-header-clip')).toHaveStyle({
        top: 24,
        height: H,
        overflow: 'hidden',
      });
      for (const offset of [-40, 0, 20, H, 400]) {
        act(() => clock.setValue(offset));
        const hidden = mode === 'pro' ? Math.min(Math.max(offset, 0), H) : 0;
        expect(
          screen.getByTestId('perps-root-header-presentation'),
        ).toHaveStyle({
          opacity: 1 - hidden / H,
          transform: [{ translateY: -hidden }],
        });
        expect(screen.getByTestId('perps-pro-header-wash')).toHaveStyle({
          transform: [{ translateY: -hidden }],
        });
        expect(
          StyleSheet.flatten(
            screen.getByTestId('perps-pro-header-wash').props.style,
          ),
        ).not.toHaveProperty('opacity');
      }
      expect(screen.getByTestId('perps-pro-header-wash-color')).toHaveStyle({
        backgroundColor: '#ffffff',
      });
      expect(screen.getByTestId('shared-header')).toHaveStyle({
        backgroundColor: 'transparent',
      });
      expect(screen.queryByTestId('perps-root-header-backdrop')).toBeNull();
      expect(
        screen.getByTestId('perps-pro-header-wash-clip').props.pointerEvents,
      ).toBe('none');
      expect(screen.getAllByTestId('shared-header')).toHaveLength(1);
    },
  );

  it('uses interruptible native settlement handoffs and preserves the header host', () => {
    const starts: Array<{ value: Animated.Value; target: number }> = [];
    const stop = jest.fn();
    const timing = jest
      .spyOn(Animated, 'timing')
      .mockImplementation((value, config) => ({
        start: () =>
          starts.push({
            value: value as Animated.Value,
            target: config.toValue as number,
          }),
        stop,
        reset: jest.fn(),
      }));
    const clock = new Animated.Value(H);
    const screen = render(<HeaderHarness {...props(clock, 'pro')} />);
    const nativeHost = () =>
      screen
        .UNSAFE_getAllByType(Animated.View)
        .find(node => node.props.testID === 'perps-root-header-presentation')!;
    const originalHostProps = nativeHost().props;
    const header = screen.getByTestId('shared-header');
    expect(timing).not.toHaveBeenCalled();

    screen.rerender(<HeaderHarness {...props(clock, 'simple')} />);
    expect(nativeHost().props).toBe(originalHostProps);
    expect(screen.getByTestId('shared-header')).toBe(header);
    expect(timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    // Mid-handoff: native graph combines both clocks, without JS scroll reads.
    act(() => starts[0].value.setValue(0.5));
    expect(screen.getByTestId('perps-root-header-presentation')).toHaveStyle({
      opacity: 0.5,
      transform: [{ translateY: -H / 2 }],
    });
    expect(screen.getByTestId('perps-pro-header-wash')).toHaveStyle({
      transform: [{ translateY: -H / 2 }],
    });
    screen.rerender(<HeaderHarness {...props(clock, 'pro')} />);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(starts[1].target).toBe(1);
    act(() => starts[1].value.setValue(1));
    expect(screen.getByTestId('perps-root-header-presentation')).toHaveStyle({
      opacity: 0,
    });
    screen.unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('keeps the wash Pro-colored even when Simple owns the shared header', () => {
    mockIsLight = false;
    const screen = render(
      <HeaderHarness {...props(new Animated.Value(0), 'simple')} />,
    );
    expect(screen.getByTestId('perps-pro-header-wash-color')).toHaveStyle({
      backgroundColor: '#131416',
    });
  });

  it('keeps one account owner and preserves mode intent/cancellation handlers', () => {
    const screen = render(
      <HeaderHarness {...props(new Animated.Value(0), 'simple')} />,
    );
    fireEvent(screen.getByTestId('mode-pro'), 'pressIn');
    fireEvent(screen.getByTestId('mode-pro'), 'pressOut');
    fireEvent.press(screen.getByTestId('mode-pro'));
    fireEvent.press(screen.getByTestId('mode-simple'));
    fireEvent.press(screen.getByTestId('account'));
    expect(pressIn).toHaveBeenCalledTimes(1);
    expect(pressOut).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('pro');
    expect(
      mockSetPopup.mock.calls[0][0]({
        isShowLoginPopup: false,
        untouched: true,
      }),
    ).toEqual({
      isShowLoginPopup: true,
      untouched: true,
    });
  });

  it('preserves the default interactive gate and releases an abandoned legacy press intent', () => {
    const screen = render(
      <HeaderHarness
        {...props(new Animated.Value(0), 'simple')}
        interactive={false}
      />,
    );
    expect(
      screen.getByTestId('perps-root-header-controls', {
        includeHiddenElements: true,
      }).props.pointerEvents,
    ).toBe('none');
    const hidden = { includeHiddenElements: true };
    fireEvent.press(screen.getByTestId('mode-pro', hidden));
    fireEvent.press(screen.getByTestId('account', hidden));
    fireEvent(screen.getByTestId('mode-pro', hidden), 'pressIn');
    fireEvent(screen.getByTestId('mode-pro', hidden), 'pressOut');
    expect(select).not.toHaveBeenCalled();
    expect(mockSetPopup).not.toHaveBeenCalled();
    expect(pressIn).not.toHaveBeenCalled();
    expect(pressOut).toHaveBeenCalledTimes(1);
  });

  it('keeps Root mode controls open despite delayed interactivity, but blocks business controls', () => {
    const pagerUI = {
      position: { value: 1 },
      selectedIndex: { value: 1 },
      select: jest.fn(),
    } as unknown as RootScenePagerUI;
    const screen = render(
      <HeaderHarness
        {...props(new Animated.Value(0), 'simple')}
        interactive={false}
        navigationEnabled
        pagerUI={pagerUI}
      />,
    );
    expect(
      screen.getByTestId('perps-root-header-controls').props,
    ).toMatchObject({
      pointerEvents: 'auto',
      collapsable: false,
      accessibilityElementsHidden: false,
    });
    expect(screen.getByTestId('shared-header').props).toMatchObject({
      pagerUI,
      navigationEnabled: true,
      businessControlsEnabled: false,
    });
    fireEvent.press(screen.getByTestId('mode-simple'));
    fireEvent.press(screen.getByTestId('mode-pro'));
    fireEvent.press(screen.getByTestId('account'));
    fireEvent(screen.getByTestId('mode-pro'), 'pressIn');
    fireEvent(screen.getByTestId('mode-pro'), 'pressOut');
    expect(pagerUI.select).toHaveBeenNthCalledWith(1, 0);
    expect(pagerUI.select).toHaveBeenNthCalledWith(2, 1);
    expect(select).not.toHaveBeenCalled();
    expect(mockSetPopup).not.toHaveBeenCalled();
    // Root taps use cold-entry initialization; optional JS prewarm callbacks
    // must not be queued behind a gesture and arrive after a later reversal.
    expect(pressIn).not.toHaveBeenCalled();
    expect(pressOut).not.toHaveBeenCalled();
  });
});
