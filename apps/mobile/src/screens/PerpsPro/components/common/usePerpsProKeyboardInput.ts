import { useCallback, useId, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { RefObject } from 'react';
import {
  PERPS_PRO_KEYBOARD_ACCESSORY_ID,
  perpsProKeyboardSession,
  type PerpsProKeyboardInput,
} from './perpsProKeyboardSession';

export const usePerpsProKeyboardInput = (
  inputRef: RefObject<PerpsProKeyboardInput | null | undefined>,
  {
    enabled = true,
    minimum = null,
    scrollTrade = false,
  }: {
    enabled?: boolean;
    minimum?: string | null;
    scrollTrade?: boolean;
  } = {},
) => {
  const id = useId();
  const minimumRef = useRef(minimum);
  minimumRef.current = minimum;
  useLayoutEffect(() => {
    perpsProKeyboardSession.updateMinimum(id, minimum);
  }, [id, minimum]);
  useLayoutEffect(() => () => perpsProKeyboardSession.blur(id), [id]);
  useLayoutEffect(() => {
    if (!enabled) {
      perpsProKeyboardSession.blur(id);
    }
  }, [enabled, id]);
  const onFocus = useCallback(() => {
    if (enabled && inputRef.current) {
      perpsProKeyboardSession.focus({
        id,
        input: inputRef.current,
        minimum: minimumRef.current,
        scrollTrade,
      });
    }
  }, [enabled, id, inputRef, scrollTrade]);
  const onBlur = useCallback(() => perpsProKeyboardSession.blur(id), [id]);
  return {
    inputAccessoryViewID:
      Platform.OS === 'ios' ? PERPS_PRO_KEYBOARD_ACCESSORY_ID : undefined,
    onBlur,
    onFocus,
  };
};
