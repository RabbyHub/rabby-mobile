import React, { useEffect, useRef } from 'react';
import { TextInput } from 'react-native';

import EventEmitter from 'events';

export const enum TouchawayInputEvents {
  'ON_PRESS_DISMISS' = 'ON_PRESS_DISMISS',
  'ON_LEAVE_SCREEN' = 'ON_LEAVE_SCREEN',
}
type BlurOnTouchawayContextType = {
  eventsRef: React.MutableRefObject<EventEmitter>;
};
export const BlurOnTouchawayContext =
  React.createContext<BlurOnTouchawayContextType>({
    eventsRef: { current: new EventEmitter() },
  });

export function useMakeTouchawayValuesOnScreen() {
  const eventsRef = useRef(new EventEmitter());

  return {
    eventsRef,
  };
}
export function useTouchaway() {
  return React.useContext(BlurOnTouchawayContext);
}
export function subscribeTouchawayEvent<T extends TouchawayInputEvents>(
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
export function useInputBlurOnTouchaway(inputRef: React.RefObject<TextInput>) {
  const { eventsRef } = React.useContext(BlurOnTouchawayContext);
  const events = eventsRef.current;

  useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeTouchawayEvent(
      events,
      TouchawayInputEvents.ON_PRESS_DISMISS,
      () => {
        inputRef.current?.blur();
      },
      { disposeRets },
    );

    subscribeTouchawayEvent(
      events,
      TouchawayInputEvents.ON_LEAVE_SCREEN,
      () => {
        inputRef.current?.blur();
      },
      { disposeRets },
    );

    return () => {
      disposeRets.forEach(dispose => dispose());
    };
  }, [events, inputRef]);
}
