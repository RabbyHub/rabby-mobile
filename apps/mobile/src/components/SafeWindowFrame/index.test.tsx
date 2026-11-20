import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

type Insets = { top: number; bottom: number; left: number; right: number };

let mockInsets: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    colors2024: { 'neutral-bg-0': '#000', 'neutral-bg-1': '#111' },
    isLight: true,
  }),
}));
jest.mock('@/core/utils/foldableDevice', () => ({
  FOLDABLE_WIDE_CENTERED_COLUMN_ENABLED: false,
  FOLDABLE_WIDE_CONTENT_MAX_WIDTH: 500,
  isFoldableIosDevice: () => true,
  isFoldableWidePosture: () => false,
}));
jest.mock('@/constant/layout', () => ({
  getScreenContentBackgroundColor: () => 'transparent',
}));
jest.mock('@/core/utils/perf', () => ({
  perfEvents: { addListener: jest.fn(), removeListener: jest.fn() },
}));

import SafeWindowFrame from './index';

function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <Text testID="counter" onPress={() => setCount(value => value + 1)}>
      {String(count)}
    </Text>
  );
}

function renderFrame() {
  return render(
    <SafeWindowFrame>
      <Counter />
    </SafeWindowFrame>,
  );
}

test('keeps the mounted child when horizontal insets appear and disappear', () => {
  const { getByTestId, rerender } = renderFrame();

  act(() => {
    getByTestId('counter').props.onPress();
  });
  expect(getByTestId('counter').props.children).toBe('1');

  mockInsets = { ...mockInsets, left: 84, right: 84 };
  rerender(
    <SafeWindowFrame>
      <Counter />
    </SafeWindowFrame>,
  );
  expect(getByTestId('counter').props.children).toBe('1');

  mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  rerender(
    <SafeWindowFrame>
      <Counter />
    </SafeWindowFrame>,
  );
  expect(getByTestId('counter').props.children).toBe('1');
});
