import type { TextInput } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { findNodeHandle, Keyboard, StatusBar, UIManager } from 'react-native';

import {
  PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
  perpsProKeyboardSession,
} from './perpsProKeyboardSession';

const INPUT_GAP = 8;
const ignoreMeasurementError = () => {};

/** Android-only layout/scroll ownership for an already mounted Pro sheet. */
export const usePerpsProSheetKeyboard = ({
  visible,
  scrollViewRef,
}: {
  visible: boolean;
  scrollViewRef: RefObject<BottomSheetScrollViewMethods | null>;
}) => {
  const sheetId = useId();
  const [accessoryInset, setAccessoryInset] = useState(0);
  const enabled = IS_ANDROID && visible;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const keyboardYRef = useRef<number | null>(null);
  const sheetReadyRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const measurementVersionRef = useRef(0);

  const cancelMeasurement = useCallback(() => {
    measurementVersionRef.current++;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const ensureInputVisible = useCallback(() => {
    cancelMeasurement();
    if (!enabledRef.current || !sheetReadyRef.current) {
      return;
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const focused = perpsProKeyboardSession.getSnapshot();
      const keyboardY = keyboardYRef.current;
      const scrollView = scrollViewRef.current;
      if (
        !focused ||
        focused.sheetId !== sheetId ||
        keyboardY == null ||
        !scrollView
      ) {
        return;
      }
      const version = measurementVersionRef.current;
      const isCurrent = () =>
        enabledRef.current &&
        sheetReadyRef.current &&
        version === measurementVersionRef.current &&
        perpsProKeyboardSession.getSnapshot()?.id === focused.id &&
        focused.input.isFocused() &&
        scrollViewRef.current === scrollView;
      const scrollNode = scrollView.getScrollableNode();
      if (scrollNode == null) {
        return;
      }
      UIManager.measureInWindow(
        scrollNode,
        (_x, viewportY, _width, viewportHeight) => {
          if (!isCurrent() || viewportHeight <= 0) {
            return;
          }
          focused.input.measureInWindow(
            (_inputX, inputY, _inputWidth, inputHeight) => {
              if (!isCurrent() || inputHeight <= 0) {
                return;
              }
              // Match the accessory's Android Paper window -> screen conversion.
              const viewportTop = viewportY + (StatusBar.currentHeight ?? 0);
              const inputTop = inputY + (StatusBar.currentHeight ?? 0);
              const visibleBottom = Math.min(
                viewportTop + viewportHeight,
                keyboardY - PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT,
              );
              const visibleHeight = visibleBottom - viewportTop;
              const below = inputTop + inputHeight + INPUT_GAP > visibleBottom;
              const above = inputTop < viewportTop + INPUT_GAP;
              if (visibleHeight <= 0 || (!below && !above)) {
                return;
              }
              const inputNode = findNodeHandle(focused.input as TextInput);
              const contentNode = scrollView.getInnerViewNode();
              if (inputNode == null || contentNode == null) {
                return;
              }
              // Measure relative to the existing content owner. No JS onScroll
              // listener or second copy of the current scroll offset is needed.
              UIManager.measureLayout(
                inputNode,
                contentNode,
                ignoreMeasurementError,
                (_left, top) => {
                  if (!isCurrent()) {
                    return;
                  }
                  scrollView.scrollTo({
                    animated: false,
                    y: Math.max(
                      0,
                      below
                        ? top + inputHeight + INPUT_GAP - visibleHeight
                        : top - INPUT_GAP,
                    ),
                  });
                },
              );
            },
          );
        },
      );
    });
  }, [cancelMeasurement, scrollViewRef, sheetId]);

  useLayoutEffect(() => {
    if (!enabled) {
      keyboardYRef.current = null;
      sheetReadyRef.current = false;
      setAccessoryInset(0);
      return;
    }
    let previousInputId: string | undefined;
    const sync = (keyboardChanged = false) => {
      const focused = perpsProKeyboardSession.getSnapshot();
      const inputId = focused?.sheetId === sheetId ? focused.id : undefined;
      const inputChanged = previousInputId !== inputId;
      previousInputId = inputId;
      setAccessoryInset(
        inputId && keyboardYRef.current != null
          ? PERPS_PRO_KEYBOARD_ACCESSORY_HEIGHT
          : 0,
      );
      if (inputChanged || keyboardChanged) {
        ensureInputVisible();
      }
    };
    const unsubscribe = perpsProKeyboardSession.subscribe(() => sync());
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardYRef.current =
        event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null;
      sync(true);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardYRef.current = null;
      sync(true);
    });
    const metrics = Keyboard.metrics();
    keyboardYRef.current =
      metrics && metrics.height > 0 ? metrics.screenY : null;
    sync(true);
    return () => {
      unsubscribe();
      show.remove();
      hide.remove();
      cancelMeasurement();
    };
  }, [cancelMeasurement, enabled, ensureInputVisible, sheetId]);

  const onSheetReadyChange = useCallback(
    (ready: boolean) => {
      sheetReadyRef.current = ready;
      ensureInputVisible();
    },
    [ensureInputVisible],
  );

  return {
    accessoryInset,
    cancelMeasurement,
    ensureInputVisible,
    onSheetReadyChange,
    sheetId,
  };
};
