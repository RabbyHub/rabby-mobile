import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { runOnUI } from 'react-native-reanimated';
import {
  nativeBoundary,
  type PanBoundary,
  type PanEvent,
} from '@/testUtils/linkedPagerNativeBoundary';

// Component contracts only: the deferred runOnJS FIFO models delivery order,
// not a second runtime, actual JS stalls, native gesture arbitration or FPS.
jest.mock('react-native-gesture-handler', () =>
  require('@/testUtils/linkedPagerNativeBoundary').createGestureBoundary(),
);
jest.mock('react-native-reanimated', () =>
  require('@/testUtils/linkedPagerNativeBoundary').createReanimatedBoundary(),
);

import {
  RootScenePager,
  type RootSceneOverlayContext,
  type RootScenePagerProps,
} from '../../../../../packages/rn-collapsible-scene-view/src/RootScenePager';

const WIDTH = 320;
const keys = ['simple', 'pro'];
const hidden = { includeHiddenElements: true };
const node = (suffix: string) =>
  screen.getByTestId(`overlay-fixture-${suffix}`, hidden);
const trackX = () =>
  StyleSheet.flatten(node('track').props.style).transform[0].translateX;
const event = (translationX = 0): PanEvent => ({
  translationX,
  translationY: 0,
  velocityX: 0,
  x: 160,
  y: 20,
  absoluteX: 160,
  absoluteY: 20,
});
const beginDrag = (translationX = -24) => {
  const gesture = node('pan').props.gesture as PanBoundary;
  expect(gesture.config.enabled).toBe(true);
  const manager = { fail: jest.fn(), activate: jest.fn(), end: jest.fn() };
  act(() => {
    gesture.touchesDown?.(
      {
        allTouches: [
          { x: 160, y: 20, absoluteX: 160, absoluteY: 20 },
        ] as Array<{ x: number; y: number }>,
        numberOfTouches: 1,
      },
      manager,
    );
    gesture.handlers.onStart(event(translationX));
  });
  expect(manager.fail).not.toHaveBeenCalled();
  return gesture;
};
const finish = () => act(() => nativeBoundary.finishAnimations());
const renderPage: RootScenePagerProps['renderPage'] = key => (
  <View testID={`page-content-${key}`} />
);
const createOverlay = () =>
  jest.fn((context: RootSceneOverlayContext) => (
    <View
      testID="shared-header"
      accessibilityLabel={`${context.selectedKey}:${context.interactive}`}
    />
  ));
const expectOverlay = (
  renderOverlay: ReturnType<typeof createOverlay>,
  context: Pick<RootSceneOverlayContext, 'selectedKey' | 'interactive'>,
) =>
  expect(renderOverlay).toHaveBeenLastCalledWith(
    expect.objectContaining(context),
  );
const overlayUI = (renderOverlay: ReturnType<typeof createOverlay>) => {
  const lastCall =
    renderOverlay.mock.calls[renderOverlay.mock.calls.length - 1];
  if (!lastCall) {
    throw new Error('Overlay has not rendered');
  }
  return lastCall[0].ui;
};
const selectUI = (
  renderOverlay: ReturnType<typeof createOverlay>,
  index: number,
) => act(() => runOnUI(overlayUI(renderOverlay).select)(index));
const flushJS = () => act(() => nativeBoundary.flushJS());

function mount(renderOverlay?: RootScenePagerProps['renderOverlay']) {
  const onSettled = jest.fn();
  const props: RootScenePagerProps = {
    keys,
    requestedKey: 'simple',
    onSettled,
    renderPage,
    renderOverlay,
    testID: 'overlay-fixture',
  };
  const result = render(<RootScenePager {...props} />);
  fireEvent(node('viewport'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
  });
  return { ...result, props, onSettled };
}

beforeEach(() => nativeBoundary.reset());
afterEach(async () => {
  await cleanupAsync();
  nativeBoundary.reset();
});

describe('RootScenePager shared overlay component contract', () => {
  it('renders one non-translated overlay under the same gesture detector', () => {
    mount(createOverlay());
    const overlay = node('overlay');
    expect(screen.getAllByTestId('shared-header')).toHaveLength(1);
    expect(within(node('pan')).getByTestId('shared-header')).toBeTruthy();
    expect(within(node('track')).queryByTestId('shared-header')).toBeNull();
    expect(overlay.props.pointerEvents).toBe('box-none');
    expect(StyleSheet.flatten(overlay.props.style)).toEqual(
      StyleSheet.absoluteFillObject,
    );

    const gesture = beginDrag();
    act(() => gesture.handlers.onUpdate(event(-WIDTH / 2)));
    expect(trackX()).toBeCloseTo(-WIDTH / 2);
    expect(
      StyleSheet.flatten(node('overlay').props.style).transform,
    ).toBeUndefined();
    expect(screen.getByTestId('shared-header').props.accessibilityLabel).toBe(
      'simple:false',
    );
  });

  it('keeps the source context until settlement and publishes no animation-frame updates', () => {
    const renderOverlay = createOverlay();
    const { props, rerender, onSettled } = mount(renderOverlay);
    expectOverlay(renderOverlay, {
      selectedKey: 'simple',
      interactive: true,
    });
    rerender(<RootScenePager {...props} requestedKey="pro" />);
    expectOverlay(renderOverlay, {
      selectedKey: 'simple',
      interactive: false,
    });
    const movingRenderCount = renderOverlay.mock.calls.length;
    act(() => nativeBoundary.advanceAnimations(0.5));
    expect(trackX()).toBeCloseTo(-WIDTH / 2);
    expect(renderOverlay).toHaveBeenCalledTimes(movingRenderCount);
    finish();
    expect(onSettled).toHaveBeenCalledWith('pro');
    expectOverlay(renderOverlay, {
      selectedKey: 'pro',
      interactive: true,
    });
  });

  it('restores the source overlay after a cancelled preview', () => {
    const renderOverlay = createOverlay();
    const { onSettled } = mount(renderOverlay);
    const gesture = beginDrag();
    act(() => {
      gesture.handlers.onUpdate(event(-30));
      gesture.handlers.onEnd(event(-30), true);
      gesture.handlers.onFinalize(event(-30), true);
    });
    expectOverlay(renderOverlay, {
      selectedKey: 'simple',
      interactive: false,
    });
    finish();
    expect(onSettled).not.toHaveBeenCalled();
    expectOverlay(renderOverlay, {
      selectedKey: 'simple',
      interactive: true,
    });
  });

  it('leaves existing callers without an overlay and retains their page hosts', () => {
    const { props, rerender, onSettled } = mount();
    const simplePage = node('page-simple');
    const proPage = node('page-pro');
    expect(screen.queryByTestId('overlay-fixture-overlay')).toBeNull();
    rerender(<RootScenePager {...props} requestedKey="pro" />);
    finish();
    expect(node('page-simple')).toBe(simplePage);
    expect(node('page-pro')).toBe(proPage);
    expect(node('page-simple').props.pointerEvents).toBe('none');
    expect(node('page-pro').props.pointerEvents).toBe('auto');
    expect(onSettled).toHaveBeenCalledWith('pro');
    expect(screen.queryByTestId('overlay-fixture-overlay')).toBeNull();
  });

  it('updates the UI track and selected index before queued JS notifications run', () => {
    const renderOverlay = createOverlay();
    const { onSettled } = mount(renderOverlay);
    const ui = overlayUI(renderOverlay);
    const rendersBefore = renderOverlay.mock.calls.length;
    nativeBoundary.setJSNotificationsDeferred(true);

    selectUI(renderOverlay, 1);
    expect(nativeBoundary.animations()).toHaveLength(1);
    act(() => nativeBoundary.advanceAnimations(0.5));
    expect(ui.position.value).toBeCloseTo(0.5);
    expect(ui.selectedIndex.value).toBe(0);
    expect(trackX()).toBeCloseTo(-WIDTH / 2);
    finish();
    expect(ui.position.value).toBe(1);
    expect(ui.selectedIndex.value).toBe(1);
    expect(trackX()).toBe(-WIDTH);
    expect(onSettled).not.toHaveBeenCalled();
    expect(renderOverlay).toHaveBeenCalledTimes(rendersBefore);
    expect(screen.getByTestId('shared-header').props.accessibilityLabel).toBe(
      'simple:true',
    );
    expect(nativeBoundary.pendingJSCount()).toBeGreaterThan(0);

    flushJS();
    expect(onSettled).toHaveBeenLastCalledWith('pro');
    expectOverlay(renderOverlay, { selectedKey: 'pro', interactive: true });
    expect(overlayUI(renderOverlay)).toBe(ui);
    expect(nativeBoundary.animations()).toHaveLength(0);
  });

  it('accepts consecutive UI selections without waiting for any JS notification', () => {
    const renderOverlay = createOverlay();
    const { onSettled } = mount(renderOverlay);
    const ui = overlayUI(renderOverlay);
    nativeBoundary.setJSNotificationsDeferred(true);

    for (const index of [1, 0, 1]) {
      selectUI(renderOverlay, index);
      finish();
      expect(ui.position.value).toBe(index);
      expect(ui.selectedIndex.value).toBe(index);
      expect(onSettled).not.toHaveBeenCalled();
    }
    const animationCount = nativeBoundary.animationHistory().length;
    // Tapping the selected mode is idempotent, including with older JS work
    // still queued. It must not start a new horizontal animation.
    selectUI(renderOverlay, 1);
    expect(nativeBoundary.animationHistory()).toHaveLength(animationCount);
    flushJS();
    expect(onSettled).toHaveBeenLastCalledWith('pro');
    expect(ui.position.value).toBe(1);
    expect(ui.selectedIndex.value).toBe(1);
    expect(nativeBoundary.animations()).toHaveLength(0);
  });

  it('can reverse twice by gesture while JS still believes the first page is selected', () => {
    const renderOverlay = createOverlay();
    const { onSettled } = mount(renderOverlay);
    const ui = overlayUI(renderOverlay);
    nativeBoundary.setJSNotificationsDeferred(true);
    selectUI(renderOverlay, 1);
    finish();

    for (const [translationX, destination] of [
      [WIDTH / 2, 0],
      [-WIDTH / 2, 1],
    ]) {
      const gesture = beginDrag(translationX);
      act(() => {
        gesture.handlers.onUpdate(event(translationX));
        gesture.handlers.onEnd(event(translationX), true);
        gesture.handlers.onFinalize(event(translationX), true);
      });
      finish();
      expect(ui.position.value).toBe(destination);
      expect(ui.selectedIndex.value).toBe(destination);
      expect(onSettled).not.toHaveBeenCalled();
    }
    flushJS();
    expectOverlay(renderOverlay, { selectedKey: 'pro', interactive: true });
    expect(ui.position.value).toBe(1);
  });

  it.each(['drag', 'tap'] as const)(
    'does not replay a late settlement echo into a newer reverse %s',
    reversal => {
      const renderOverlay = createOverlay();
      const onSettled = jest.fn();
      function EchoingHost() {
        const [requestedKey, setRequestedKey] = React.useState('simple');
        return (
          <RootScenePager
            keys={keys}
            requestedKey={requestedKey}
            onSettled={key => {
              onSettled(key);
              setRequestedKey(key);
            }}
            renderPage={renderPage}
            renderOverlay={renderOverlay}
            testID="overlay-fixture"
          />
        );
      }
      render(<EchoingHost />);
      fireEvent(node('viewport'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
      });
      const ui = overlayUI(renderOverlay);
      nativeBoundary.setJSNotificationsDeferred(true);
      selectUI(renderOverlay, 1);
      finish();
      expect(ui.selectedIndex.value).toBe(1);

      const reverse = reversal === 'drag' ? beginDrag(WIDTH / 4) : undefined;
      if (reverse) {
        act(() => reverse.handlers.onUpdate(event(WIDTH / 2)));
      } else {
        selectUI(renderOverlay, 0);
        act(() => nativeBoundary.advanceAnimations(0.5));
      }
      expect(ui.position.value).toBeCloseTo(0.5);
      const animationCount = nativeBoundary.animationHistory().length;
      // Consume each older message in FIFO order. A React commit can echo its
      // completed key between messages, while UI is already in the next drag.
      let flushed = 0;
      while (nativeBoundary.pendingJSCount() > 0) {
        expect(++flushed).toBeLessThan(20);
        act(() => nativeBoundary.flushNextJS());
        expect(ui.position.value).toBeCloseTo(0.5);
        expect(trackX()).toBeCloseTo(-WIDTH / 2);
        expect(nativeBoundary.animationHistory()).toHaveLength(animationCount);
        expect(nativeBoundary.animations()).toHaveLength(reverse ? 0 : 1);
      }
      if (reverse) {
        act(() => {
          reverse.handlers.onEnd(event(WIDTH / 2), true);
          reverse.handlers.onFinalize(event(WIDTH / 2), true);
        });
      }
      finish();
      expect(ui.position.value).toBe(0);
      expect(ui.selectedIndex.value).toBe(0);
      flushJS();
      expect(onSettled).toHaveBeenLastCalledWith('simple');
      expectOverlay(renderOverlay, {
        selectedKey: 'simple',
        interactive: true,
      });
      expect(nativeBoundary.animations()).toHaveLength(0);
    },
  );

  it('invalidates the previous snap when another UI selection interrupts it', () => {
    const renderOverlay = createOverlay();
    const { onSettled } = mount(renderOverlay);
    const ui = overlayUI(renderOverlay);
    nativeBoundary.setJSNotificationsDeferred(true);
    selectUI(renderOverlay, 1);
    const cancelled = nativeBoundary.animations()[0];
    act(() => nativeBoundary.advanceAnimations(0.4));
    expect(ui.position.value).toBeCloseTo(0.4);
    selectUI(renderOverlay, 0);
    expect(cancelled.cancelled).toBe(true);
    // A late native completion of the old animation must not publish its
    // endpoint or replace the newer snap. This directly probes its epoch fence.
    act(() => cancelled.callback?.(true, 1));
    expect(ui.position.value).toBeCloseTo(0.4);
    expect(ui.selectedIndex.value).toBe(0);
    expect(nativeBoundary.animations()).toHaveLength(1);
    finish();
    flushJS();
    expect(ui.position.value).toBe(0);
    expect(ui.selectedIndex.value).toBe(0);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('ignores disabled UI selections, keeps route commands, and resumes the same UI API', () => {
    const renderOverlay = createOverlay();
    const { props, rerender } = mount(renderOverlay);
    const ui = overlayUI(renderOverlay);
    nativeBoundary.setJSNotificationsDeferred(true);
    rerender(<RootScenePager {...props} enabled={false} />);
    expect((node('pan').props.gesture as PanBoundary).config.enabled).toBe(
      false,
    );
    selectUI(renderOverlay, 1);
    expect(ui.position.value).toBe(0);
    expect(nativeBoundary.animations()).toHaveLength(0);

    // enabled is a UI navigation gate, not a restriction on route commands.
    rerender(<RootScenePager {...props} enabled={false} requestedKey="pro" />);
    finish();
    expect(ui.position.value).toBe(1);
    expect(ui.selectedIndex.value).toBe(1);
    selectUI(renderOverlay, 0);
    expect(nativeBoundary.animations()).toHaveLength(0);
    rerender(<RootScenePager {...props} enabled requestedKey="pro" />);
    expect(overlayUI(renderOverlay)).toBe(ui);
    selectUI(renderOverlay, 0);
    finish();
    flushJS();
    expect(ui.position.value).toBe(0);
    expect(ui.selectedIndex.value).toBe(0);
    expectOverlay(renderOverlay, { selectedKey: 'simple', interactive: true });
  });

  it('rejects pre-layout and invalid UI selections', () => {
    const renderOverlay = createOverlay();
    const onSettled = jest.fn();
    render(
      <RootScenePager
        keys={keys}
        requestedKey="simple"
        renderPage={renderPage}
        renderOverlay={renderOverlay}
        onSettled={onSettled}
        testID="overlay-fixture"
      />,
    );
    const ui = overlayUI(renderOverlay);
    selectUI(renderOverlay, 1);
    expect(nativeBoundary.animations()).toHaveLength(0);
    expect(ui.position.value).toBe(0);
    fireEvent(node('viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
    });
    for (const index of [-1, 2, 0.5, NaN, Infinity]) {
      selectUI(renderOverlay, index);
      expect(nativeBoundary.animations()).toHaveLength(0);
      expect(ui.position.value).toBe(0);
    }
    expect(onSettled).not.toHaveBeenCalled();
    selectUI(renderOverlay, 1);
    finish();
    expect(ui.position.value).toBe(1);
    expect(onSettled).toHaveBeenCalledWith('pro');
  });

  it.each(['moving', 'settled'])(
    'ignores queued JS messages and retained UI callbacks after unmount (%s)',
    phase => {
      const renderOverlay = createOverlay();
      const { onSettled, unmount } = mount(renderOverlay);
      const ui = overlayUI(renderOverlay);
      nativeBoundary.setJSNotificationsDeferred(true);
      selectUI(renderOverlay, 1);
      if (phase === 'settled') {
        finish();
      } else {
        act(() => nativeBoundary.advanceAnimations(0.5));
      }
      expect(nativeBoundary.pendingJSCount()).toBeGreaterThan(0);
      unmount();
      const positionAfterUnmount = ui.position.value;
      act(() => runOnUI(ui.select)(0));
      finish();
      flushJS();
      expect(ui.position.value).toBe(positionAfterUnmount);
      expect(nativeBoundary.animations()).toHaveLength(0);
      expect(onSettled).not.toHaveBeenCalled();
    },
  );
});
