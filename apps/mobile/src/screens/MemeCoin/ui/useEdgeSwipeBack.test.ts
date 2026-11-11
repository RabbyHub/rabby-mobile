import 'react-native-gesture-handler/jestSetup';
import { renderHook } from '@testing-library/react-native';
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

  it('counts a long or fast swipe from the edge as back', () => {
    expect(isEdgeSwipeBack({ translationX: 64, velocityX: 0 })).toBe(true);
    expect(isEdgeSwipeBack({ translationX: 10, velocityX: 600 })).toBe(true);
    expect(isEdgeSwipeBack({ translationX: 63, velocityX: 599 })).toBe(false);
  });
});
