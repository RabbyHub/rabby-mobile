import { RootStackParamsList } from '@/navigation-type';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef =
  createNavigationContainerRef<RootStackParamsList>();

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
    // You can decide what to do if react navigation is not ready
    // You can ignore this, or add these actions to a queue you can call later
  }
}) as typeof navigationRef.navigate;

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
            routes: [{ name: defaultRouteName }],
          },
        },
      ],
    });
  }
};
