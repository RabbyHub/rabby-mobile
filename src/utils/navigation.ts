import {createNavigationContainerRef} from '@react-navigation/native';
import {atom, useAtomValue, useSetAtom} from 'jotai';

export const navigationRef =
  createNavigationContainerRef<
    Record<string, Record<string, string | object> | undefined>
  >();

const currentRouteNameAtom = atom<string | undefined>(undefined);
export function useCurrentRouteNameInAppStatusBar() {
  return useAtomValue(currentRouteNameAtom);
}

export function useSetCurrentRouteName() {
  return useSetAtom(currentRouteNameAtom);
}

/**
 * navigate in pure function
 *
 * https://reactnavigation.org/docs/navigating-without-navigation-prop
 */
export function navigate(name: string, params?: Record<string, string>) {
  if (navigationRef.isReady()) {
    // Perform navigation if the react navigation is ready to handle actions
    navigationRef.navigate(name, params);
  } else {
    // You can decide what to do if react navigation is not ready
    // You can ignore this, or add these actions to a queue you can call later
  }
}

export const redirectBackErrorHandler = (
  navigation: any,
  defaultRouteName: string = 'Hi',
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
            routes: [{name: defaultRouteName}],
          },
        },
      ],
    });
  }
};
