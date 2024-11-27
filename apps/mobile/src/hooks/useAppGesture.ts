import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * @description make sure call this hook under the context of react-navigation
 * @platform android
 */
export function useHandleBackPressClosable(
  shouldBack: (() => boolean) | React.RefObject<boolean>,
  {
    autoEffectEnabled = false,
  }: {
    /**
     * @description whether handle hardware back press automatically by `useEffect`
     */
    autoEffectEnabled?: boolean;
  } = {},
) {
  const shouldPreventFn = useCallback(() => {
    if (typeof shouldBack === 'function') {
      return !shouldBack();
    }

    return !shouldBack.current;
  }, [shouldBack]);

  const onHardwareBackHandler = useCallback(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        /**
         * @see https://reactnavigation.org/docs/custom-android-back-button-handling/
         *
         * Returning true from onBackPress denotes that we have handled the event,
         * and react-navigation's listener will not get called, thus not popping the screen.
         *
         * Returning false will cause the event to bubble up and react-navigation's listener
         * will pop the screen.
         */
        return shouldPreventFn();
      },
    );

    return () => subscription.remove();
  }, [shouldPreventFn]);

  const disposeRef = useRef<null | (() => void)>(null);
  useEffect(() => {
    const clearDispose = () => {
      disposeRef.current?.();
      disposeRef.current = null;
    };
    if (autoEffectEnabled) {
      disposeRef.current = onHardwareBackHandler();
      return () => clearDispose();
    } else {
      clearDispose();
    }
  }, [autoEffectEnabled, onHardwareBackHandler]);

  return {
    onHardwareBackHandler,
  };
}
