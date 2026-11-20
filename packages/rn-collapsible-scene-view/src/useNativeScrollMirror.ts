import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated as NativeAnimated } from 'react-native';

// This is a public runtime API (also used by RN's own sticky headers), but
// React Native 0.81's legacy Animated typings do not declare it yet.
const nativeAnimated = NativeAnimated as typeof NativeAnimated & {
  attachNativeEvent: (
    target: unknown,
    eventName: 'onScroll',
    mapping: { nativeEvent: { contentOffset: { y: NativeAnimated.Value } } }[],
  ) => { detach: () => void };
};

type Attachment = {
  detach: () => void;
  target: unknown;
  value: NativeAnimated.Value;
};

export type NativeScrollMirrorHandle = {
  /** Attach (or re-attach) the mirror to a mounted list instance. */
  sync: (instance: unknown) => void;
};

/**
 * Mirrors a scroll view's native `contentOffset.y` into a
 * `NativeAnimated.Value`, so overlay layers can follow the scroll on the
 * native driver instead of waiting for a worklet round-trip.
 */
export const useNativeScrollMirror = (
  nativeScrollY?: NativeAnimated.Value,
): NativeScrollMirrorHandle => {
  const attachment = useRef<Attachment | null>(null);
  const instance = useRef<unknown>(null);

  const sync = useCallback(
    (nextInstance: unknown) => {
      instance.current = nextInstance;
      const scrollComponent =
        (
          nextInstance as { getNativeScrollRef?: () => unknown } | null
        )?.getNativeScrollRef?.() ?? null;
      // A list's scroll component may itself be a wrapper (gesture-handler's
      // ScrollView forwards to a real ScrollView); resolve one step further
      // when it can.
      const target =
        (
          scrollComponent as { getNativeScrollRef?: () => unknown } | null
        )?.getNativeScrollRef?.() ?? scrollComponent;
      const value = nativeScrollY;
      const previous = attachment.current;
      if (previous?.target === target && previous?.value === value) {
        return;
      }
      previous?.detach();
      attachment.current = null;
      if (target && value) {
        const next = nativeAnimated.attachNativeEvent(target, 'onScroll', [
          { nativeEvent: { contentOffset: { y: value } } },
        ]);
        attachment.current = { detach: next.detach, target, value };
      }
    },
    [nativeScrollY],
  );

  useLayoutEffect(() => {
    // The list ref may survive a value swap (e.g. a shared header clock is
    // mounted after the list). Re-run attachment against the same instance.
    if (instance.current) {
      sync(instance.current);
    }
  }, [sync]);

  useLayoutEffect(
    () => () => {
      attachment.current?.detach();
      attachment.current = null;
    },
    [],
  );

  return useMemo(() => ({ sync }), [sync]);
};
