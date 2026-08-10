import { observeFeatureActivationNavigation } from './useFeatureActivationDiagnostics.nonprod';

const mockNavigationListeners = new Map<string, Set<() => void>>();
const mockNavigation = {
  focused: true,
  isFocused: jest.fn(() => mockNavigation.focused),
  addListener: jest.fn((event: string, listener: () => void) => {
    const listeners = mockNavigationListeners.get(event) || new Set();
    listeners.add(listener);
    mockNavigationListeners.set(event, listeners);
    return () => listeners.delete(listener);
  }),
};
const mockEnsureFeatureActivation = jest.fn(() => 1);
const mockMarkFeatureActivation = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('@/core/utils/featureActivationDiagnostics', () => ({
  ensureFeatureActivation: (...args: unknown[]) =>
    mockEnsureFeatureActivation(...args),
  markFeatureActivation: (...args: unknown[]) =>
    mockMarkFeatureActivation(...args),
}));

function emitNavigationEvent(event: 'focus' | 'blur') {
  mockNavigationListeners.get(event)?.forEach(listener => listener());
}

describe('observeFeatureActivationNavigation', () => {
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let nextFrameId = 0;
  const frameScheduler = {
    requestFrame: jest.fn((callback: FrameRequestCallback) => {
      const frameId = ++nextFrameId;
      frameCallbacks.set(frameId, callback);
      return frameId;
    }),
    cancelFrame: jest.fn((frameId: number) => {
      frameCallbacks.delete(frameId);
    }),
  };

  beforeEach(() => {
    mockNavigation.focused = true;
    mockNavigation.isFocused.mockClear();
    mockNavigation.addListener.mockClear();
    mockNavigationListeners.clear();
    mockEnsureFeatureActivation.mockClear();
    mockMarkFeatureActivation.mockClear();
    frameCallbacks.clear();
    nextFrameId = 0;
    frameScheduler.requestFrame.mockClear();
    frameScheduler.cancelFrame.mockClear();
  });

  it('records focus changes through navigation listeners', () => {
    const unsubscribe = observeFeatureActivationNavigation({
      feature: 'gas-account',
      navigation: mockNavigation,
      frameScheduler,
    });

    expect(mockMarkFeatureActivation).toHaveBeenCalledWith(
      'gas-account',
      'visible',
      expect.objectContaining({ cycleId: 1 }),
    );

    mockNavigation.focused = false;
    emitNavigationEvent('blur');
    mockNavigation.focused = true;
    emitNavigationEvent('focus');

    expect(mockMarkFeatureActivation).toHaveBeenCalledWith(
      'gas-account',
      'exited',
      expect.objectContaining({ reason: 'navigation_focus_ended' }),
    );

    unsubscribe();
    expect(mockNavigationListeners.get('focus')?.size).toBe(0);
    expect(mockNavigationListeners.get('blur')?.size).toBe(0);
  });

  it('does not duplicate activation when focus fires repeatedly', () => {
    observeFeatureActivationNavigation({
      feature: 'swap',
      navigation: mockNavigation,
      frameScheduler,
    });
    const visibleCount = () =>
      mockMarkFeatureActivation.mock.calls.filter(
        call => call[0] === 'swap' && call[1] === 'visible',
      ).length;

    expect(visibleCount()).toBe(1);
    emitNavigationEvent('focus');
    emitNavigationEvent('focus');

    expect(visibleCount()).toBe(1);
  });
});
