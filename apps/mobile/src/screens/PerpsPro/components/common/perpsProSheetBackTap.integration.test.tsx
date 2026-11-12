import { act, cleanup, renderHook } from '@testing-library/react-native';
import type { View } from 'react-native';
import {
  beginPerpsProSheetBackTap,
  resetPerpsProSheetNavigationGuardForTests,
  usePerpsProSheetNavigationRegistration,
} from './perpsProSheetNavigationRegistry';

// The registry and hook are real. Only the asynchronous native View measurement
// is substituted; this does not claim UIKit/RNGH hit-testing coverage.
type Measure = (x: number, y: number, width: number, height: number) => void;
const point = { absoluteX: 20, absoluteY: 300 };
const setup = () => {
  let measure: Measure | undefined;
  const node = {
    measureInWindow: jest.fn((callback: Measure) => {
      measure = callback;
    }),
  };
  const target = {
    ref: { current: node as unknown as View | null },
    sessionKey: 'modify:1',
  };
  const props = {
    active: true,
    dismiss: jest.fn(),
    dismissible: true,
    edgeDismissible: true,
    backTarget: target,
  };
  const hook = renderHook(
    next => usePerpsProSheetNavigationRegistration(next),
    { initialProps: props },
  );
  return {
    hook,
    node,
    props,
    target,
    measure: (...args: Parameters<Measure>) => act(() => measure?.(...args)),
  };
};

beforeEach(resetPerpsProSheetNavigationGuardForTests);
afterEach(cleanup);

it.each([
  ['inside', 300, 300, 1],
  ['outside', 100, 100, 0],
  ['entered from outside', 100, 300, 0],
  ['left the button', 300, 400, 0],
])(
  'only dismisses a tap owned by the back button: %s',
  (_name, startY, endY, calls) => {
    const test = setup();
    const tap = beginPerpsProSheetBackTap(test.hook.result.current, {
      ...point,
      absoluteY: startY as number,
    });
    tap?.finish({ ...point, absoluteY: endY as number });
    test.measure(0, 280, 72, 72);
    tap?.finish(point);
    test.measure(0, 280, 72, 72);
    expect(test.props.dismiss).toHaveBeenCalledTimes(calls as number);
  },
);

it.each([
  'cancel',
  'locked',
  'edge-locked',
  'page',
  'page-roundtrip',
  'ref',
  'unmount',
  'covered',
  'stack-roundtrip',
])('rejects an asynchronous button measurement after %s', action => {
  const test = setup();
  const tap = beginPerpsProSheetBackTap(test.hook.result.current, point);
  tap?.finish(point);
  expect(test.node.measureInWindow).toHaveBeenCalledTimes(1);
  if (action === 'cancel') {
    tap?.cancel();
  }
  if (action === 'locked') {
    test.hook.rerender({ ...test.props, dismissible: false });
  }
  if (action === 'edge-locked') {
    test.hook.rerender({ ...test.props, edgeDismissible: false });
  }
  if (action === 'page' || action === 'page-roundtrip') {
    test.hook.rerender({
      ...test.props,
      backTarget: { ...test.target, sessionKey: 'add:2' },
    });
    if (action === 'page-roundtrip') {
      test.hook.rerender({
        ...test.props,
        backTarget: { ...test.target, sessionKey: 'modify:3' },
      });
    }
  }
  if (action === 'ref') {
    test.target.ref.current = null;
  }
  if (action === 'unmount') {
    test.hook.unmount();
  }
  if (action === 'covered' || action === 'stack-roundtrip') {
    const top = renderHook(() =>
      usePerpsProSheetNavigationRegistration({
        active: true,
        dismiss: jest.fn(),
      }),
    );
    if (action === 'stack-roundtrip') {
      top.unmount();
    }
  }
  test.measure(0, 280, 72, 72);
  expect(test.props.dismiss).not.toHaveBeenCalled();
});

it('does not opt other sheets into edge taps or use missing native geometry', () => {
  const hook = renderHook(() =>
    usePerpsProSheetNavigationRegistration({
      active: true,
      dismiss: jest.fn(),
    }),
  );
  expect(beginPerpsProSheetBackTap(hook.result.current, point)).toBeNull();
  const test = setup();
  beginPerpsProSheetBackTap(test.hook.result.current, point)?.finish(point);
  test.measure(0, 0, 0, 0);
  expect(test.props.dismiss).not.toHaveBeenCalled();
});
