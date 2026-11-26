import React, { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

import { useBizMockAction } from './useBizMockAction';

export type BizMockPressableProps = PressableProps & {
  /** Stable semantic key used by `action.invoke&id=...`. */
  bizMockId: string;
  /** Optional UI locator alias used by `action.invoke&testID=...`. */
  bizMockTestID?: string;
};

/**
 * A `Pressable` that also registers its real `onPress` handler for biz-mock.
 *
 * Renders and behaves exactly like `Pressable`; the registration is a guarded
 * non-production side effect inside `useBizMockAction`.
 */
export const BizMockPressable = forwardRef<View, BizMockPressableProps>(
  ({ bizMockId, bizMockTestID, onPress, ...rest }, ref) => {
    useBizMockAction({
      id: bizMockId,
      testID: bizMockTestID,
      handler: onPress || (() => undefined),
    });

    return <Pressable ref={ref} onPress={onPress} {...rest} />;
  },
);

BizMockPressable.displayName = 'BizMockPressable';
