// https://github.com/react-navigation/react-navigation/blob/7b761f1cc0/packages/native-stack/src/navigators/createNativeStackNavigator.tsx
import {
  createNavigatorFactory,
  EventArg,
  ParamListBase,
  StackActionHelpers,
  StackActions,
  StackNavigationState,
  StackRouterOptions,
  useNavigationBuilder,
} from '@react-navigation/native';
import {NativeStackView} from '@react-navigation/native-stack';
import type {
  NativeStackNavigationEventMap,
  NativeStackNavigationOptions,
  NativeStackNavigatorProps,
} from '@react-navigation/native-stack/lib/typescript/src/types';
import * as React from 'react';

import {CustomStackRouter} from './CustomStackRouter';

function NativeStackNavigator({
  initialRouteName,
  children,
  screenListeners,
  screenOptions,
  ...rest
}: NativeStackNavigatorProps) {
  const {state, descriptors, navigation, NavigationContent} =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      StackRouterOptions,
      StackActionHelpers<ParamListBase>,
      NativeStackNavigationOptions,
      NativeStackNavigationEventMap
    >(CustomStackRouter, {
      initialRouteName,
      children,
      screenListeners,
      screenOptions,
    });

  React.useEffect(
    () =>
      navigation?.addListener?.('tabPress', (e: any) => {
        const isFocused = navigation.isFocused();

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          if (
            state.index > 0 &&
            isFocused &&
            !(e as EventArg<'tabPress', true>).defaultPrevented
          ) {
            // When user taps on already focused tab and we're inside the tab,
            // reset the stack to replicate native behaviour
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: state.key,
            });
          }
        });
      }),
    [navigation, state.index, state.key],
  );

  return (
    <NavigationContent>
      <NativeStackView
        {...rest}
        state={state}
        navigation={navigation}
        descriptors={descriptors}
      />
    </NavigationContent>
  );
}

export default createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  NativeStackNavigationOptions,
  NativeStackNavigationEventMap,
  typeof NativeStackNavigator
>(NativeStackNavigator);

export const createCustomNativeStackNavigator = createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  NativeStackNavigationOptions,
  NativeStackNavigationEventMap,
  typeof NativeStackNavigator
>(NativeStackNavigator);
