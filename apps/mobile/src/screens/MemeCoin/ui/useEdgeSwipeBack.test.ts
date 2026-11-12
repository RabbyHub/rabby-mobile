import 'react-native-gesture-handler/jestSetup';
import { createElement } from 'react';
import { View } from 'react-native';
import { render, renderHook } from '@testing-library/react-native';
import {
  GestureDetector,
  State,
  type PanGesture,
} from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';
import { isEdgeSwipeBack, useEdgeSwipeBack } from './useEdgeSwipeBack';

const mockRootSetOptions = jest.fn();
let mockIsIOS = true;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    getParent: () => ({ setOptions: mockRootSetOptions }),
  }),
}));
jest.mock('@/core/native/utils', () => ({
  get IS_IOS() {
    return mockIsIOS;
  },
}));

beforeEach(() => {
  mockRootSetOptions.mockReset();
  mockIsIOS = true;
});

describe('useEdgeSwipeBack', () => {
  it('turns the root swipe off on iOS while active, and back on after', () => {
    const hook = renderHook(
      ({ active }) => useEdgeSwipeBack(active, jest.fn()),
      { initialProps: { active: false } },
    );
    expect(mockRootSetOptions).not.toHaveBeenCalled();

    hook.rerender({ active: true });
    expect(mockRootSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: false,
    });

    hook.rerender({ active: false });
    expect(mockRootSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: true,
    });
  });

  it('turns the swipe back on when the page goes away while active', () => {
    const hook = renderHook(() => useEdgeSwipeBack(true, jest.fn()));
    hook.unmount();
    expect(mockRootSetOptions).toHaveBeenLastCalledWith({
      gestureEnabled: true,
    });
  });

  it('leaves the root swipe alone on Android', () => {
    mockIsIOS = false;
    renderHook(() => useEdgeSwipeBack(true, jest.fn()));
    expect(mockRootSetOptions).not.toHaveBeenCalled();
  });

  it('goes back only when the swipe ends, not when it is cancelled or fails', () => {
    const onBack = jest.fn();
    let gesture!: ReturnType<typeof useEdgeSwipeBack>;
    // events only reach a gesture attached to a detector
    const Harness = () => {
      gesture = useEdgeSwipeBack(true, onBack);
      return createElement(GestureDetector, { gesture }, createElement(View));
    };
    render(createElement(Harness));
    const swipe = (last: State) =>
      fireGestureHandler<PanGesture>(gesture, [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 80 },
        { state: last, translationX: 80 },
      ]);

    swipe(State.CANCELLED);
    swipe(State.FAILED);
    expect(onBack).not.toHaveBeenCalled();

    swipe(State.END);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('counts a long or fast swipe from the edge as back', () => {
    expect(isEdgeSwipeBack({ translationX: 64, velocityX: 0 })).toBe(true);
    expect(isEdgeSwipeBack({ translationX: 10, velocityX: 600 })).toBe(true);
    expect(isEdgeSwipeBack({ translationX: 63, velocityX: 599 })).toBe(false);
  });
});
