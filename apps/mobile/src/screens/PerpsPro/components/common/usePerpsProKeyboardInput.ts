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
    getMinimum,
    minimum = null,
    scrollTrade = false,
  }: {
    enabled?: boolean;
    getMinimum?: () => string | null;
    minimum?: string | null;
    scrollTrade?: boolean;
  } = {},
) => {
  const id = useId();
  const minimumRef = useRef({ getMinimum, minimum });
  minimumRef.current = { getMinimum, minimum };
  useLayoutEffect(() => {
    perpsProKeyboardSession.updateMinimum(id, getMinimum ?? minimum);
  }, [getMinimum, id, minimum]);
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
        minimum: minimumRef.current.getMinimum
          ? minimumRef.current.getMinimum()
          : minimumRef.current.minimum,
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
