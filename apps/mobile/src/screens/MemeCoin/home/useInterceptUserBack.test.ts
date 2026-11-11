import 'react-native-gesture-handler/jestSetup';
import { act, renderHook } from '@testing-library/react-native';
import {
  isEdgeSwipeBack,
  useEdgeSwipeBack,
  useInterceptUserBack,
} from './useInterceptUserBack';

type Remove = (options: { data: { action: { type: string } } }) => void;

const mockDispatch = jest.fn();
const mockRootSetOptions = jest.fn();
const mockPreventRemove = jest.fn<void, [boolean, Remove]>();
let mockIsIOS = true;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: (active: boolean, callback: Remove) =>
    mockPreventRemove(active, callback),
}));
jest.mock('@/core/native/utils', () => ({
  get IS_IOS() {
    return mockIsIOS;
  },
}));

const mockNavigation = {
  dispatch: (...args: unknown[]) => mockDispatch(...args),
  getParent: () => ({ setOptions: mockRootSetOptions }),
};

const lastCall = () =>
  mockPreventRemove.mock.calls[mockPreventRemove.mock.calls.length - 1];
const remove = (type: string) =>
  act(() => lastCall()[1]({ data: { action: { type } } }));

beforeEach(() => {
  mockDispatch.mockReset();
  mockRootSetOptions.mockReset();
  mockPreventRemove.mockReset();
  mockIsIOS = true;
});

describe('useInterceptUserBack', () => {
  it('only holds the screen while active', () => {
    const hook = renderHook(
      ({ active }) => useInterceptUserBack(active, jest.fn()),
      { initialProps: { active: false } },
    );
    expect(lastCall()[0]).toBe(false);
    hook.rerender({ active: true });
    expect(lastCall()[0]).toBe(true);
  });

  it.each(['GO_BACK', 'POP'])('takes over %s and stays', type => {
    const onBack = jest.fn();
    renderHook(() => useInterceptUserBack(true, onBack));
    remove(type);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(lastCall()[0]).toBe(true);
  });

  it('lets any other navigation through once the hold is off', () => {
    const onBack = jest.fn();
    renderHook(() => useInterceptUserBack(true, onBack));
    remove('RESET');
    expect(onBack).not.toHaveBeenCalled();
    expect(lastCall()[0]).toBe(false);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'RESET' });
  });
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

  it('turns the swipe back on when the page goes away mid-holdings', () => {
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
