import { RNGHTextInput, type TextInput } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';
import {
  BottomSheetTextInput,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { findNodeHandle } from 'react-native';
// Only access the native focus registry; rendered inputs use Typography.
import { TextInput as NativeTextInput } from 'react-native';
import { runOnUI } from 'react-native-reanimated';

type InputProps = React.ComponentProps<typeof TextInput>;

const AndroidTpSlTextInput = React.forwardRef<TextInput, InputProps>(
  ({ onFocus, onBlur, ...props }, forwardedRef) => {
    const ref = useRef<RNGHTextInput>(null);
    const { animatedKeyboardState, textInputNodesRef } =
      useBottomSheetInternal();
    useImperativeHandle(forwardedRef, () => ref.current!);

    const updateTarget = useCallback(
      (target: number, clear: boolean) => {
        'worklet';
        // Read and update on UI together. A JS snapshot can overwrite a queued
        // keyboardDidHide with SHOWN when focus/blur crosses the native bridge.
        const state = animatedKeyboardState.get();
        if (clear && state.target !== target) {
          return;
        }
        animatedKeyboardState.set({
          ...state,
          target: clear ? undefined : target,
        });
      },
      [animatedKeyboardState],
    );

    const handleFocus = useCallback<NonNullable<InputProps['onFocus']>>(
      event => {
        runOnUI(updateTarget)(event.nativeEvent.target, false);
        onFocus?.(event);
      },
      [onFocus, updateTarget],
    );
    const handleBlur = useCallback<NonNullable<InputProps['onBlur']>>(
      event => {
        const focusedNode = findNodeHandle(
          NativeTextInput.State.currentlyFocusedInput() as NativeTextInput | null,
        );
        // Preserve the library's hand-off between inputs in the same sheet.
        if (!focusedNode || !textInputNodesRef.current.has(focusedNode)) {
          runOnUI(updateTarget)(event.nativeEvent.target, true);
        }
        onBlur?.(event);
      },
      [onBlur, textInputNodesRef, updateTarget],
    );

    useEffect(() => {
      const node = findNodeHandle(ref.current);
      if (node == null) {
        return;
      }
      const nodes = textInputNodesRef.current;
      nodes.add(node);
      return () => {
        nodes.delete(node);
        // The native ref may already be null during effect cleanup.
        runOnUI(updateTarget)(node, true);
      };
    }, [textInputNodesRef, updateTarget]);

    return (
      <RNGHTextInput
        {...props}
        ref={ref}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);
AndroidTpSlTextInput.displayName = 'AndroidTpSlTextInput';

export const PerpsProPositionTpSlBottomSheetTextInput = React.forwardRef<
  TextInput,
  InputProps
>((props, forwardedRef) =>
  IS_ANDROID ? (
    <AndroidTpSlTextInput {...props} ref={forwardedRef} />
  ) : (
    <BottomSheetTextInput
      {...props}
      ref={
        forwardedRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
      }
    />
  ),
);

PerpsProPositionTpSlBottomSheetTextInput.displayName =
  'PerpsProPositionTpSlBottomSheetTextInput';
