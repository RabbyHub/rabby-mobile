import { act, render } from '@testing-library/react-native';
import React from 'react';
import { PerpsProSheetKeyboardAnimation } from './PerpsProSheetKeyboardAnimation';

const mockAnimation = { value: { status: 1 } };
const mockScrollable = { value: 1 };
let mockPrepare: () => boolean;
let mockReact: (ready: boolean, previous: boolean | null) => void;
jest.mock('@gorhom/bottom-sheet', () => ({
  ANIMATION_STATUS: { STOPPED: 2 },
  SCROLLABLE_STATUS: { UNLOCKED: 1 },
  useBottomSheetInternal: () => ({
    animatedAnimationState: mockAnimation,
    animatedScrollableStatus: mockScrollable,
  }),
}));
jest.mock('react-native-reanimated', () => ({
  runOnJS: (callback: Function) => callback,
  useAnimatedReaction: (
    prepare: typeof mockPrepare,
    react: typeof mockReact,
  ) => {
    mockPrepare = prepare;
    mockReact = react;
  },
}));

it('reports completed same-index animations only when scrolling is unlocked, with no late callbacks', () => {
  const onReadyChange = jest.fn();
  const view = render(
    <PerpsProSheetKeyboardAnimation onReadyChange={onReadyChange} />,
  );
  act(() => mockReact(mockPrepare(), null));
  expect(onReadyChange).toHaveBeenLastCalledWith(false);
  mockAnimation.value.status = 2;
  act(() => mockReact(mockPrepare(), false));
  expect(onReadyChange).toHaveBeenLastCalledWith(true);
  mockScrollable.value = 0;
  act(() => mockReact(mockPrepare(), true));
  expect(onReadyChange).toHaveBeenLastCalledWith(false);
  mockScrollable.value = 1;
  act(() => mockReact(mockPrepare(), false));
  expect(onReadyChange).toHaveBeenLastCalledWith(true);
  onReadyChange.mockClear();
  act(() => mockReact(mockPrepare(), true));
  expect(onReadyChange).not.toHaveBeenCalled();
  view.unmount();
  onReadyChange.mockClear();
  act(() => mockReact(true, false));
  expect(onReadyChange).not.toHaveBeenCalled();
});
