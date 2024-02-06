import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * @description make sure call this hook under the context of react-navigation
 */
export function useHandleBackPress(
  checkCondition: (() => boolean) | React.RefObject<boolean>,
) {
  const checkFn = useCallback(() => {
    if (typeof checkCondition === 'function') {
      return checkCondition();
    }

    return checkCondition.current;
  }, [checkCondition]);

  const onFocusBackHandler = useCallback(() => {
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
        return !!checkFn();
      },
    );

    return () => subscription.remove();
  }, [checkFn]);

  useFocusEffect(onFocusBackHandler);
}
