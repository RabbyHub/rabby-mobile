import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform, RefreshControl } from 'react-native';
import { CollapsibleRefreshControl } from './CollapsibleRefreshControl';

const fabricGlobal = global as typeof global & {
  nativeFabricUIManager?: object;
};
const originalFabric = fabricGlobal.nativeFabricUIManager;

afterEach(() => {
  jest.restoreAllMocks();
  if (originalFabric === undefined) {
    delete fabricGlobal.nativeFabricUIManager;
  } else {
    fabricGlobal.nativeFabricUIManager = originalFabric;
  }
});

it.each([
  ['ios', true, 72, 0],
  ['ios', true, -12, 0],
  ['ios', false, 72, 72],
  ['ios', false, undefined, undefined],
  ['android', true, 72, 72],
  ['android', false, 72, 72],
  ['android', true, undefined, undefined],
] as const)(
  'resolves a cloned offset on %s (Fabric=%s, offset=%s)',
  (os, fabric, injectedOffset, expectedOffset) => {
    jest.replaceProperty(Platform, 'OS', os);
    fabricGlobal.nativeFabricUIManager = fabric ? {} : undefined;
    const onRefresh = jest.fn();
    const control = (
      <CollapsibleRefreshControl
        testID="refresh"
        refreshing={false}
        onRefresh={onRefresh}
      />
    );

    // The Tabs list clones the caller's refresh element. The wrapper must
    // normalize that injected value, not merely set a default on its child.
    const { UNSAFE_getByType, rerender } = render(
      React.cloneElement(control, { progressViewOffset: injectedOffset }),
    );
    expect(UNSAFE_getByType(RefreshControl).props.progressViewOffset).toBe(
      expectedOffset,
    );
    fireEvent(UNSAFE_getByType(RefreshControl), 'refresh');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      React.cloneElement(control, {
        progressViewOffset: injectedOffset,
        refreshing: true,
      }),
    );
    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
    expect(UNSAFE_getByType(RefreshControl).props.progressViewOffset).toBe(
      expectedOffset,
    );
  },
);

it('preserves the chosen native component and forwards its ref', () => {
  const AlternateNativeControl = React.forwardRef<
    RefreshControl,
    React.ComponentProps<typeof RefreshControl>
  >((props, forwardedRef) => <RefreshControl {...props} ref={forwardedRef} />);
  const ref = React.createRef<RefreshControl>();
  const { UNSAFE_getByType } = render(
    <CollapsibleRefreshControl
      as={AlternateNativeControl}
      ref={ref}
      refreshing={false}
    />,
  );
  expect(UNSAFE_getByType(AlternateNativeControl).props.refreshing).toBe(false);
  expect(ref.current).toBe(UNSAFE_getByType(RefreshControl).instance);
  expect(ref.current).not.toBeNull();
});
