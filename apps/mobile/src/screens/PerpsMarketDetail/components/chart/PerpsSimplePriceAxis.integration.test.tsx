import React from 'react';
import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { PerpsSimplePriceAxis } from './PerpsSimplePriceAxis';

// JS integration: real gesture builder/component/bridge batching; native manager
// and UI-thread execution use the repository's RNGH/Reanimated test boundaries.
describe('Simple native price-axis gesture wiring', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const mount = () => {
    const scroll = Gesture.Native();
    const build = jest.spyOn(Gesture, 'Manual');
    const onCommand = jest.fn();
    const tree = render(
      <GestureHandlerRootView>
        <PerpsSimplePriceAxis
          scrollGesture={scroll}
          owner="axis-1"
          paneWidth={310}
          paneHeight={274}
          onCommand={onCommand}
        />
      </GestureHandlerRootView>,
    );
    const gesture = build.mock.results[0].value as ReturnType<
      typeof Gesture.Manual
    >;
    const manager = {
      begin: jest.fn(),
      activate: jest.fn(),
      end: jest.fn(),
      fail: jest.fn(),
      handlerTag: 1,
    };
    const event = (y: number, count = 1) => ({
      handlerTag: 1,
      numberOfTouches: count,
      allTouches: [{ id: 7, x: 5, y, absoluteX: 325, absoluteY: y }],
      changedTouches: [{ id: 7, x: 5, y, absoluteX: 325, absoluteY: y }],
      eventType: 1,
    });
    return { tree, scroll, gesture, manager, onCommand, event };
  };

  it('blocks the page from touch-down and limits the overlay to the price-axis pane', () => {
    const { tree, scroll, gesture, manager, onCommand, event } = mount();
    expect(gesture.config.blocksHandlers).toContain(scroll);
    const strip = tree
      .UNSAFE_getAllByProps({ collapsable: false })
      .find(node => StyleSheet.flatten(node.props.style)?.left === 322)!;
    expect(StyleSheet.flatten(strip.props.style)).toMatchObject({
      top: 12,
      left: 322,
      right: 0,
      height: 274,
    });
    act(() => gesture.handlers.onTouchesDown!(event(100), manager));
    expect(manager.begin).toHaveBeenCalledTimes(1);
    expect(manager.activate).toHaveBeenCalledTimes(1);
    act(() => {
      gesture.handlers.onTouchesMove!(event(120), manager);
      gesture.handlers.onTouchesUp!(event(130), manager);
      gesture.handlers.onTouchesCancelled!(event(130), manager);
      gesture.handlers.onFinalize!(
        { handlerTag: 1, state: 5, numberOfPointers: 0, pointerType: 0 },
        true,
      );
      jest.runAllTimers();
    });
    expect(manager.end).toHaveBeenCalledTimes(1);
    expect(manager.fail).not.toHaveBeenCalled();
    expect(onCommand.mock.calls.map(([, message]) => message.phase)).toEqual([
      'start',
      'end',
    ]);
    expect(onCommand.mock.calls[1][1]).toMatchObject({ deltaY: 30 });
  });

  it.each(['multi-touch', 'cancel', 'unmount'])(
    'releases pending movement on %s',
    boundary => {
      const { tree, gesture, manager, onCommand, event } = mount();
      act(() => {
        gesture.handlers.onTouchesDown!(event(100), manager);
        gesture.handlers.onTouchesMove!(event(140), manager);
        if (boundary === 'multi-touch')
          gesture.handlers.onTouchesDown!(event(140, 2), manager);
        else if (boundary === 'cancel')
          gesture.handlers.onTouchesCancelled!(event(140), manager);
        else tree.unmount();
      });
      // Let React commit the unmount before advancing the next display frame.
      act(() => jest.runAllTimers());
      expect(onCommand.mock.calls.map(([, message]) => message.phase)).toEqual([
        'start',
        'cancel',
      ]);
      if (boundary !== 'unmount') expect(manager.end).toHaveBeenCalledTimes(1);
    },
  );

  it('fails a multi-finger start before acquiring the native gesture', () => {
    const { gesture, manager, onCommand, event } = mount();
    act(() => gesture.handlers.onTouchesDown!(event(100, 2), manager));
    expect(manager.fail).toHaveBeenCalledTimes(1);
    expect(manager.activate).not.toHaveBeenCalled();
    expect(onCommand).not.toHaveBeenCalled();
  });
});
