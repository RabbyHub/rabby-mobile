import { RootStackParamsList } from '@/navigation-type';
import {
  StackActions,
  createNavigationContainerRef,
} from '@react-navigation/native';

export const navigationRef =
  createNavigationContainerRef<RootStackParamsList>();

export function getReadyNavigationInstance() {
  return navigationRef.isReady() ? navigationRef.current : null;
}

export function getLatestNavigationName() {
  try {
    if (!navigationRef.isReady()) return undefined;
  } catch (error) {
    return undefined;
  }

  return navigationRef.getCurrentRoute()?.name;
}
/**
 * navigate in pure function
 *
 * https://reactnavigation.org/docs/navigating-without-navigation-prop
 */
export const navigate = ((...arg: any) => {
  if (navigationRef.isReady()) {
    // Perform navigation if the react navigation is ready to handle actions
    navigationRef.navigate(...arg);
  } else {
    __DEV__ && console.warn('[navigate] navigationRef is not ready');
    // You can decide what to do if react navigation is not ready
    // You can ignore this, or add these actions to a queue you can call later
  }
}) as typeof navigationRef.navigate;

export const replace = ((name: any, pramas?: object) => {
  if (navigationRef.isReady()) {
    // Perform navigation if the react navigation is ready to handle actions
    navigationRef.dispatch(StackActions.replace(name, pramas));
  } else {
    // You can decide what to do if react navigation is not ready
    // You can ignore this, or add these actions to a queue you can call later
  }
}) as typeof navigationRef.navigate;

export const redirectBackErrorHandler = (
  navigation: any,
  defaultRouteName: string = 'Home',
) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigationRef.resetRoot({
      index: 0,
      routes: [
        {
          name: 'Root',
          state: {
            index: 0,
            routes: [{ name: defaultRouteName }],
          },
        },
      ],
    });
  }
};
