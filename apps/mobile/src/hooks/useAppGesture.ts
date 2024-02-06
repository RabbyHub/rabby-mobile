import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * @description make sure call this hook under the context of react-navigation
 * @platform android
 */
export function useHandleBackPressClosable(
  shouldClose: (() => boolean) | React.RefObject<boolean>,
) {
  const shouldPreventFn = useCallback(() => {
    if (typeof shouldClose === 'function') {
      return !shouldClose();
    }

    return !shouldClose.current;
  }, [shouldClose]);

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

  return {
    onHardwareBackHandler,
  };
}
