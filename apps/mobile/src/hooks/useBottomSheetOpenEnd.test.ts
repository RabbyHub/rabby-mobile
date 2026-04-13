import { renderHook } from '@testing-library/react-native';

const mockUseBottomSheetInternal = jest.fn();
const mockUseAnimatedReaction = jest.fn();
const mockRunOnJS = jest.fn((fn: () => void) => fn);

function loadUseBottomSheetOpenEndModule() {
  jest.resetModules();

  jest.doMock('@gorhom/bottom-sheet', () => ({
    ANIMATION_STATUS: {
      STOPPED: 'STOPPED',
    },
    useBottomSheetInternal: (...args: unknown[]) =>
      mockUseBottomSheetInternal(...args),
  }));

  jest.doMock('react-native-reanimated', () => ({
    useAnimatedReaction: (...args: unknown[]) =>
      mockUseAnimatedReaction(...args),
    runOnJS: (...args: unknown[]) => mockRunOnJS(...args),
  }));

  return require('./useBottomSheetOpenEnd') as typeof import('./useBottomSheetOpenEnd');
}

describe('useBottomSheetOpenEnd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAnimatedReaction.mockImplementation(
      (
        prepare: () => unknown,
        react: (value: unknown, previousValue?: unknown) => void,
      ) => {
        react(prepare());
      },
    );
  });

  it('runs the callback when the bottom sheet animation status is STOPPED', () => {
    const onOpenEnd = jest.fn();
    mockUseBottomSheetInternal.mockReturnValue({
      animatedPosition: { value: 100 },
      animatedAnimationState: {
        value: {
          status: 'STOPPED',
        },
      },
    });

    const { useBottomSheetOpenEnd } = loadUseBottomSheetOpenEndModule();
    renderHook(() => useBottomSheetOpenEnd(onOpenEnd));

    expect(mockUseBottomSheetInternal).toHaveBeenCalledWith(true);
    expect(mockRunOnJS).toHaveBeenCalledWith(onOpenEnd);
    expect(onOpenEnd).toHaveBeenCalledTimes(1);
  });

  it('does not run the callback while the animation is still active', () => {
    const onOpenEnd = jest.fn();
    mockUseBottomSheetInternal.mockReturnValue({
      animatedPosition: { value: 100 },
      animatedAnimationState: {
        value: {
          status: 'RUNNING',
        },
      },
    });

    const { useBottomSheetOpenEnd } = loadUseBottomSheetOpenEndModule();
    renderHook(() => useBottomSheetOpenEnd(onOpenEnd));

    expect(mockRunOnJS).not.toHaveBeenCalled();
    expect(onOpenEnd).not.toHaveBeenCalled();
  });
});
