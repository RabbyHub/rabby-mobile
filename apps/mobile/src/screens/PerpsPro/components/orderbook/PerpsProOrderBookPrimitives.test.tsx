import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';

const mockThemeRender = jest.fn();

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    mockThemeRender();
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

import {
  PerpsProOrderBookDepth,
  PerpsProOrderBookModeIcon,
  PerpsProOrderBookRow,
} from './PerpsProOrderBookPrimitives';

describe('PerpsProOrderBookModeIcon', () => {
  it.each([
    ['asks', 'red-default'],
    ['bids', 'green-default'],
  ] as const)(
    'keeps the left guide fixed and merges the right side for %s',
    (mode, backgroundColor) => {
      render(<PerpsProOrderBookModeIcon mode={mode} />);

      const guide = screen.getByTestId('perps-pro-order-book-mode-guide');
      expect(guide.children).toHaveLength(3);
      guide.children.forEach(child => {
        expect(StyleSheet.flatten((child as any).props.style)).toMatchObject({
          backgroundColor: 'neutral-info',
        });
      });

      const sides = screen.getByTestId('perps-pro-order-book-mode-sides');
      expect(sides.children).toHaveLength(0);
      expect(StyleSheet.flatten(sides.props.style)).toMatchObject({
        backgroundColor,
        borderRadius: 1,
        height: 18,
        width: 8,
      });
    },
  );

  it('keeps the two colored right cells split in both mode', () => {
    render(<PerpsProOrderBookModeIcon mode="both" />);

    const sides = screen.getByTestId('perps-pro-order-book-mode-sides');
    expect(sides.children).toHaveLength(2);
    expect(StyleSheet.flatten(sides.props.style)).toMatchObject({ gap: 2 });
    expect(
      StyleSheet.flatten((sides.children[0] as any).props.style),
    ).toMatchObject({ backgroundColor: 'red-default' });
    expect(
      StyleSheet.flatten((sides.children[1] as any).props.style),
    ).toMatchObject({ backgroundColor: 'green-default' });
  });
});

describe('PerpsProOrderBookRow', () => {
  let nativeTiming: jest.SpyInstance;
  let setValue: jest.SpyInstance;
  let stopAnimation: jest.SpyInstance;

  beforeEach(() => {
    mockThemeRender.mockClear();
    nativeTiming = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    });
    setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    stopAnimation = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips unchanged row props without retaining an obsolete press handler', () => {
    const onSelectPrice = jest.fn();
    const nextOnSelectPrice = jest.fn();
    const props = {
      amount: 200,
      price: '100',
      priceNumber: 100,
      onSelectPrice,
      priceDecimals: 2,
      side: 'bid' as const,
    };
    const view = render(<PerpsProOrderBookRow {...props} />);
    expect(mockThemeRender).toHaveBeenCalledTimes(1);

    view.rerender(<PerpsProOrderBookRow {...props} />);
    expect(mockThemeRender).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProOrderBookRow {...props} onSelectPrice={nextOnSelectPrice} />,
    );
    expect(mockThemeRender).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByTestId('perps-pro-order-book-row'));
    expect(nextOnSelectPrice).toHaveBeenCalledTimes(1);
    expect(nextOnSelectPrice).toHaveBeenCalledWith('100');
    expect(onSelectPrice).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProOrderBookRow {...props} onSelectPrice={undefined} />,
    );
    expect(mockThemeRender).toHaveBeenCalledTimes(3);
    expect(
      screen.getByTestId('perps-pro-order-book-row').props.accessibilityRole,
    ).toBeUndefined();
    fireEvent.press(screen.getByTestId('perps-pro-order-book-row'));
    expect(nextOnSelectPrice).toHaveBeenCalledTimes(1);
  });

  it('updates displayed amount, precision and side independently without invalidating identical scalars', () => {
    const props = {
      amount: 200,
      amountDecimals: 2,
      price: '100.125',
      priceNumber: 100.125,
      priceDecimals: 2,
      side: 'bid' as const,
    };
    const view = render(<PerpsProOrderBookRow {...props} />);
    expect(screen.getByText('100.13')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(mockThemeRender).toHaveBeenCalledTimes(1);
    view.rerender(<PerpsProOrderBookRow {...props} />);
    expect(mockThemeRender).toHaveBeenCalledTimes(1);

    view.rerender(<PerpsProOrderBookRow {...props} amount={20.555} />);
    expect(screen.getByText('20.56')).toBeTruthy();
    expect(screen.queryByText('200')).toBeNull();
    expect(mockThemeRender).toHaveBeenCalledTimes(2);
    view.rerender(
      <PerpsProOrderBookRow {...props} amount={20.555} amountDecimals={1} />,
    );
    expect(screen.getByText('20.6')).toBeTruthy();
    expect(mockThemeRender).toHaveBeenCalledTimes(3);
    view.rerender(
      <PerpsProOrderBookRow
        {...props}
        amount={20.555}
        amountDecimals={1}
        priceDecimals={3}
      />,
    );
    expect(screen.getByText('100.125')).toBeTruthy();
    expect(screen.queryByText('100.13')).toBeNull();
    expect(mockThemeRender).toHaveBeenCalledTimes(4);
    expect(
      StyleSheet.flatten(screen.getByText('100.125').props.style),
    ).toMatchObject({ color: 'green-default' });
    view.rerender(
      <PerpsProOrderBookRow
        {...props}
        amount={20.555}
        amountDecimals={1}
        priceDecimals={3}
        side="ask"
      />,
    );
    expect(mockThemeRender).toHaveBeenCalledTimes(5);
    expect(
      StyleSheet.flatten(screen.getByText('100.125').props.style),
    ).toMatchObject({ color: 'red-default' });
  });

  it('uses the latest intent callback and raw price even when the formatted price is unchanged', () => {
    const onSelectPrice = jest.fn();
    const onSelectPriceIntentStart = jest.fn();
    const nextOnSelectPriceIntentStart = jest.fn();
    const props = {
      amount: 200,
      onSelectPrice,
      onSelectPriceIntentStart,
      price: '100.1234',
      priceNumber: 100.1234,
      priceDecimals: 2,
      side: 'bid' as const,
    };
    const view = render(<PerpsProOrderBookRow {...props} />);
    expect(screen.getByText('100.12')).toBeTruthy();
    fireEvent(screen.getByTestId('perps-pro-order-book-row'), 'pressIn');
    expect(onSelectPriceIntentStart).toHaveBeenCalledWith('100.1234');

    view.rerender(
      <PerpsProOrderBookRow
        {...props}
        onSelectPriceIntentStart={nextOnSelectPriceIntentStart}
      />,
    );
    fireEvent(screen.getByTestId('perps-pro-order-book-row'), 'pressIn');
    expect(nextOnSelectPriceIntentStart).toHaveBeenCalledWith('100.1234');
    expect(onSelectPriceIntentStart).toHaveBeenCalledTimes(1);

    view.rerender(
      <PerpsProOrderBookRow
        {...props}
        onSelectPriceIntentStart={nextOnSelectPriceIntentStart}
        price="100.123400"
      />,
    );
    expect(screen.getByText('100.12')).toBeTruthy();
    fireEvent(screen.getByTestId('perps-pro-order-book-row'), 'pressIn');
    fireEvent.press(screen.getByTestId('perps-pro-order-book-row'));
    expect(nextOnSelectPriceIntentStart).toHaveBeenLastCalledWith('100.123400');
    expect(onSelectPrice).toHaveBeenLastCalledWith('100.123400');

    view.rerender(
      <PerpsProOrderBookRow
        {...props}
        onSelectPriceIntentStart={nextOnSelectPriceIntentStart}
        price="101.987654"
        priceNumber={101.987654}
      />,
    );
    expect(screen.getByText('101.99')).toBeTruthy();
    expect(screen.queryByText('100.12')).toBeNull();
    fireEvent(screen.getByTestId('perps-pro-order-book-row'), 'pressIn');
    fireEvent.press(screen.getByTestId('perps-pro-order-book-row'));
    expect(nextOnSelectPriceIntentStart).toHaveBeenLastCalledWith('101.987654');
    expect(onSelectPrice).toHaveBeenLastCalledWith('101.987654');
    expect(onSelectPriceIntentStart).toHaveBeenCalledTimes(1);
  });

  it('skips unchanged depth scalars but applies row position and target changes', () => {
    const props = {
      animationIdentity: 'BTC:5:null|both|6|content',
      price: '100',
      targetPercent: 50,
      rowIndex: 0,
      side: 'bid' as const,
    };
    const view = render(<PerpsProOrderBookDepth {...props} />);
    expect(mockThemeRender).toHaveBeenCalledTimes(1);
    setValue.mockClear();

    view.rerender(<PerpsProOrderBookDepth {...props} />);
    expect(mockThemeRender).toHaveBeenCalledTimes(1);
    expect(setValue).not.toHaveBeenCalled();
    expect(nativeTiming).not.toHaveBeenCalled();

    view.rerender(<PerpsProOrderBookDepth {...props} rowIndex={2} />);
    expect(mockThemeRender).toHaveBeenCalledTimes(2);
    expect(nativeTiming).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-book-depth').props.style,
      ),
    ).toMatchObject({
      top: 40,
      width: '100%',
      right: 0,
      transformOrigin: 'right center',
      transform: [{ scaleX: 0.5 }],
    });
    expect(
      screen.getByTestId('perps-pro-order-book-depth').props.pointerEvents,
    ).toBe('none');
    view.rerender(
      <PerpsProOrderBookDepth {...props} targetPercent={25} rowIndex={2} />,
    );
    expect(mockThemeRender).toHaveBeenCalledTimes(3);
    expect(nativeTiming).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 0.25 }),
    );
    view.rerender(
      <PerpsProOrderBookDepth {...props} targetPercent={25} rowIndex={2} />,
    );
    expect(mockThemeRender).toHaveBeenCalledTimes(3);
    expect(nativeTiming).toHaveBeenCalledTimes(1);
    view.rerender(
      <PerpsProOrderBookDepth
        {...props}
        targetPercent={25}
        rowIndex={2}
        side="ask"
      />,
    );
    expect(mockThemeRender).toHaveBeenCalledTimes(4);
    expect(nativeTiming).toHaveBeenCalledTimes(1);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-book-depth').props.style,
      ),
    ).toMatchObject({ backgroundColor: 'red-light-1', top: 40 });
  });

  it('renders a neutral placeholder and emits an invalid price attempt', () => {
    const onSelectPrice = jest.fn();
    const onSelectPriceIntentStart = jest.fn();
    render(
      <PerpsProOrderBookRow
        amount={0}
        onSelectPrice={onSelectPrice}
        onSelectPriceIntentStart={onSelectPriceIntentStart}
        price={null}
        priceNumber={0}
        priceDecimals={2}
        side="ask"
      />,
    );

    const placeholders = screen.getAllByText('--');
    expect(placeholders).toHaveLength(2);
    placeholders.forEach(placeholder => {
      expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
        color: 'neutral-secondary',
      });
    });
    const row = screen.getByTestId('perps-pro-order-book-row');
    fireEvent(row, 'pressIn');
    fireEvent.press(row);
    expect(onSelectPriceIntentStart).toHaveBeenCalledWith(null);
    expect(onSelectPrice).toHaveBeenCalledTimes(1);
    expect(onSelectPrice).toHaveBeenCalledWith(null);
  });

  it('keeps the Figma row inset and shared platform font', () => {
    render(
      <PerpsProOrderBookRow
        amount={200}
        price="100"
        priceNumber={100}
        priceDecimals={2}
        side="bid"
      />,
    );

    const price = screen.getByText('100.00');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-book-row').props.style,
      ),
    ).toMatchObject({ gap: 4, padding: 2 });
    expect(StyleSheet.flatten(price.props.style)).toMatchObject({
      fontFamily: 'SF Pro Rounded',
    });
    expect(
      StyleSheet.flatten(screen.getByText('200').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
    });
  });

  it('uses market size precision below 1K and fixed K/M/B precision', () => {
    const view = render(
      <PerpsProOrderBookRow
        amount={20}
        amountDecimals={1}
        price="100"
        priceNumber={100}
        priceDecimals={2}
        side="bid"
      />,
    );

    expect(screen.getByText('20')).toBeTruthy();
    view.rerender(
      <PerpsProOrderBookRow
        amount={20.5}
        amountDecimals={1}
        price="100"
        priceNumber={100}
        priceDecimals={2}
        side="bid"
      />,
    );
    expect(screen.getByText('20.5')).toBeTruthy();

    view.rerender(
      <PerpsProOrderBookRow
        amount={1000}
        amountDecimals={1}
        price="100"
        priceNumber={100}
        priceDecimals={2}
        side="bid"
      />,
    );
    expect(screen.getByText('1.00K')).toBeTruthy();
  });

  it('animates only a retained price in the same presentation context', () => {
    const view = render(
      <PerpsProOrderBookDepth
        animationIdentity="BTC:5:null|both|6|content"
        price="100"
        targetPercent={50}
        rowIndex={3}
        side="bid"
      />,
    );

    expect(nativeTiming).not.toHaveBeenCalled();
    setValue.mockClear();

    view.rerender(
      <PerpsProOrderBookDepth
        animationIdentity="BTC:5:null|both|6|content"
        price="100"
        targetPercent={75}
        rowIndex={2}
        side="bid"
      />,
    );

    expect(nativeTiming).toHaveBeenCalledWith(expect.any(Animated.Value), {
      toValue: 0.75,
      duration: 250,
      easing: expect.any(Function),
      useNativeDriver: true,
      isInteraction: false,
    });
    expect(setValue).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProOrderBookDepth
        animationIdentity="BTC:5:null|both|6|content"
        price="101"
        targetPercent={25}
        rowIndex={2}
        side="bid"
      />,
    );

    expect(nativeTiming).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenLastCalledWith(0.25);

    view.rerender(
      <PerpsProOrderBookDepth
        animationIdentity="ETH:5:null|both|6|content"
        price="101"
        targetPercent={50}
        rowIndex={1}
        side="bid"
      />,
    );

    expect(nativeTiming).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledTimes(2);
    expect(setValue).toHaveBeenLastCalledWith(0.5);

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-book-depth').props.style,
      ),
    ).toMatchObject({ height: 20, top: 20 });
    stopAnimation.mockClear();
    view.unmount();

    expect(nativeTiming).toHaveBeenCalledTimes(1);
    expect(stopAnimation).toHaveBeenCalled();
  });
});
