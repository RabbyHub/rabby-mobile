import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import EventEmitter from 'events';
import { TextInput } from '@/components/Typography';

export const enum TouchawayInputEvents {
  'ON_PRESS_DISMISS' = 'ON_PRESS_DISMISS',
  'ON_LEAVE_SCREEN' = 'ON_LEAVE_SCREEN',
}

function subscribeTouchawayEvent<T extends TouchawayInputEvents>(
  events: EventEmitter,
  type: T,
  cb: (payload: any) => void,
  options?: { disposeRets?: Function[] },
) {
  const { disposeRets } = options || {};
  const dispose = () => {
    events.off(type, cb);
  };

  if (disposeRets) {
    disposeRets.push(dispose);
  }

  events.on(type, cb);

  return dispose;
}
export function useInputBlurOnTouchaway(
  inputRefs:
    | React.RefObject<TextInput | null>
    | React.RefObject<TextInput | null>[],
) {
  const eventsRef = useRef(new EventEmitter());
  const events = eventsRef.current;

  const inputRefList = useMemo(
    () => (Array.isArray(inputRefs) ? inputRefs : [inputRefs]),
    [inputRefs],
  );

  useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeTouchawayEvent(
      events,
      TouchawayInputEvents.ON_PRESS_DISMISS,
      () => {
        inputRefList.forEach(ref => ref.current?.blur());
      },
      { disposeRets },
    );

    subscribeTouchawayEvent(
      events,
      TouchawayInputEvents.ON_LEAVE_SCREEN,
      () => {
        inputRefList.forEach(ref => ref.current?.blur());
      },
      { disposeRets },
    );

    return () => {
      disposeRets.forEach(dispose => dispose());
    };
  }, [events, inputRefList]);

  const onTouchInputAway = useCallback(() => {
    events.emit(TouchawayInputEvents.ON_PRESS_DISMISS);
  }, [events]);

  return {
    onTouchInputAway,
  };
}
