import { useCallback, useContext, useId, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  perpsProKeyboardSession,
  type PerpsProKeyboardInput,
} from './perpsProKeyboardSession';
import { PerpsProKeyboardSheetContext } from './PerpsProKeyboardSheetContext';
import { getPerpsProKeyboardAccessoryID } from './perpsProKeyboardAccessoryBinding';

export const usePerpsProKeyboardInput = (
  inputRef: RefObject<PerpsProKeyboardInput | null | undefined>,
  {
    enabled = true,
    getMinimum,
    minimum = null,
    scrollTrade = false,
    sheetId: providedSheetId,
  }: {
    enabled?: boolean;
    getMinimum?: () => string | null;
    minimum?: string | null;
    scrollTrade?: boolean;
    sheetId?: string;
  } = {},
) => {
  const id = useId();
  const contextSheetId = useContext(PerpsProKeyboardSheetContext);
  const sheetId = providedSheetId ?? contextSheetId;
  const minimumRef = useRef({ getMinimum, minimum });
  minimumRef.current = { getMinimum, minimum };
  useLayoutEffect(() => {
    perpsProKeyboardSession.updateMinimum(id, getMinimum ?? minimum);
  }, [getMinimum, id, minimum]);
  useLayoutEffect(() => () => perpsProKeyboardSession.unregister(id), [id]);
  useLayoutEffect(() => {
    if (!enabled) {
      perpsProKeyboardSession.unregister(id);
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
        sheetId,
      });
    }
  }, [enabled, id, inputRef, scrollTrade, sheetId]);
  const onBlur = useCallback(() => perpsProKeyboardSession.blur(id), [id]);
  return {
    inputAccessoryViewID: getPerpsProKeyboardAccessoryID(id),
    onBlur,
    onFocus,
  };
};
