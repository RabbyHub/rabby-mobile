import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { TextInput } from 'react-native';

import EventEmitter from 'events';

export const enum TouchawayInputEvents {
  'ON_PRESS_DISMISS' = 'ON_PRESS_DISMISS',
  'ON_LEAVE_SCREEN' = 'ON_LEAVE_SCREEN',
}
type BlurOnTouchawayContextType = {
  eventsRef: React.MutableRefObject<EventEmitter>;
};

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
  inputRefs: React.RefObject<TextInput> | React.RefObject<TextInput>[],
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
