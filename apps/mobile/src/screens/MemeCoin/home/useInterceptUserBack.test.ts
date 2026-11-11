import { act, renderHook } from '@testing-library/react-native';
import { useInterceptUserBack } from './useInterceptUserBack';

type Remove = (options: { data: { action: { type: string } } }) => void;

const mockDispatch = jest.fn();
const mockPreventRemove = jest.fn<void, [boolean, Remove]>();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (active: boolean, callback: Remove) =>
    mockPreventRemove(active, callback),
}));

const lastCall = () =>
  mockPreventRemove.mock.calls[mockPreventRemove.mock.calls.length - 1];
const remove = (type: string) =>
  act(() => lastCall()[1]({ data: { action: { type } } }));

describe('useInterceptUserBack', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockPreventRemove.mockReset();
  });

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
