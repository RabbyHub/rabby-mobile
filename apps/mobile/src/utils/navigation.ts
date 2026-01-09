import { RootNames } from '@/constant/layout';
import { RootStackParamsList } from '@/navigation-type';
import {
  CommonActions,
  StackActions,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

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
 * @deprecated
 * navigate in pure function
 *
 * https://reactnavigation.org/docs/navigating-without-navigation-prop
 */
export const navigate: NativeStackScreenProps<RootStackParamsList>['navigation']['navigate'] =
  ((...arg: any) => {
    if (navigationRef.isReady()) {
      // Perform navigation if the react navigation is ready to handle actions
      navigationRef.navigate(...arg);
    } else {
      __DEV__ && console.warn('[navigate] navigationRef is not ready');
      // You can decide what to do if react navigation is not ready
      // You can ignore this, or add these actions to a queue you can call later
    }
  }) as typeof navigationRef.navigate;

/**
 * behave like `navigate` in v6.x
 *
 * https://reactnavigation.org/docs/upgrading-from-6.x/#the-navigate-method-no-longer-goes-back-use-popto-instead
 */
export const navigateDeprecated: NativeStackScreenProps<RootStackParamsList>['navigation']['navigateDeprecated'] =
  ((...arg: any) => {
    if (navigationRef.isReady()) {
      // Perform navigation if the react navigation is ready to handle actions
      navigationRef.navigateDeprecated(...arg);
    } else {
      __DEV__ &&
        console.warn('[navigateDeprecated] navigationRef is not ready');
      // You can decide what to do if react navigation is not ready
      // You can ignore this, or add these actions to a queue you can call later
    }
  }) as typeof navigationRef.navigateDeprecated;

// @ts-expect-error
export const naviPush: NativeStackScreenProps<RootStackParamsList>['navigation']['push'] =
  (name, pramas) => {
    if (navigationRef.isReady()) {
      // Perform navigation if the react navigation is ready to handle actions
      navigationRef.dispatch(StackActions.push(name, pramas));
    } else {
      __DEV__ && console.warn('[naviPush] navigationRef is not ready');
      // You can decide what to do if react navigation is not ready
      // You can ignore this, or add these actions to a queue you can call later
    }
  };

export const naviReplace: NativeStackScreenProps<RootStackParamsList>['navigation']['replace'] =
  ((name: any, pramas?: object) => {
    if (navigationRef.isReady()) {
      // Perform navigation if the react navigation is ready to handle actions
      navigationRef.dispatch(StackActions.replace(name, pramas));
    } else {
      // You can decide what to do if react navigation is not ready
      // You can ignore this, or add these actions to a queue you can call later
    }
  }) as typeof navigationRef.navigate;

/** @deprecated use `naviReplace` instead */
export const replace = naviReplace;

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

export function redirectToAddAddressEntry(options?: {
  action?: `${'' | 'classical:'}${'push' | 'replace' | 'resetTo'}`;
}) {
  // navigateDeprecated(RootNames.StackAddress, {
  //   screen: RootNames.ImportNewAddress,
  // });

  const action = options?.action || 'classical:push';

  switch (action) {
    case 'classical:push': {
      navigateDeprecated(RootNames.StackAddress, {
        screen: RootNames.ImportNewAddress,
      });
      break;
    }
    case 'classical:replace': {
      replace(RootNames.StackAddress, {
        screen: RootNames.ImportNewAddress,
      });
      break;
    }
    case 'classical:resetTo': {
      navigationRef.resetRoot({
        index: 0,
        routes: [
          {
            name: 'Root',
            state: {
              index: 0,
              routes: [{ name: RootNames.ImportNewAddress }],
            },
          },
        ],
      });
      break;
    }
    case 'replace':
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStartedScreen2024,
      });
      break;
    case 'resetTo':
      navigationRef.resetRoot({
        index: 0,
        routes: [
          {
            name: RootNames.StackGetStarted,
            state: {
              index: 0,
              routes: [{ name: RootNames.GetStartedScreen2024 }],
            },
          },
        ],
      });
      break;
    case 'push':
    default:
      navigateDeprecated(RootNames.StackGetStarted, {
        screen: RootNames.GetStartedScreen2024,
      });
      break;
  }
}

/** @deprecated use `resetNavigationOnTopOfHome` instead */
export const replaceToFirst: typeof naviReplace = (name, params?) => {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: RootNames.StackRoot,
            params: {
              screen: RootNames.Home,
            },
          },
          {
            name: name,
            params: params || {},
          },
        ],
      }),
    );
  } else {
    // You can decide what to do if react navigation is not ready
    // You can ignore this, or add these actions to a queue you can call later
  }
};
