import { RootNames } from '@/constant/layout';
import { perfEvents } from '@/core/utils/perf';
import { RootStackParamsList } from '@/navigation-type';
import {
  CommonActions,
  StackActions,
  createNavigationContainerRef,
} from '@react-navigation/native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export const navigationRef =
  createNavigationContainerRef<RootStackParamsList>();

const resetRootAndClearCoveredComponents = (
  state: Parameters<typeof navigationRef.resetRoot>[0],
) => {
  perfEvents.emit('GLOBAL_CLEAR_ALL_COVERED_COMPONENTS');
  navigationRef.resetRoot(state);
};

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

/**
 * Push a root-stack screen, then silently insert `underlay` beneath it so
 * backing out (header back or iOS swipe) lands on the underlay first.
 *
 * The underlay is inserted one frame later because pushing both screens in
 * one commit briefly flashes the underlay before the top screen appears,
 * and presetting a nested multi-route state breaks iOS swipe-back (child
 * navigators disable gestureEnabled, so the root stack handles the gesture
 * and pops the whole nested stack at once).
 */
export function naviPushWithUnderlay<
  RouteName extends keyof RootStackParamsList,
  UnderlayName extends keyof RootStackParamsList,
>(
  name: RouteName,
  params: RootStackParamsList[RouteName],
  underlay: { name: UnderlayName; params?: RootStackParamsList[UnderlayName] },
) {
  if (!navigationRef.isReady()) {
    __DEV__ &&
      console.warn('[naviPushWithUnderlay] navigationRef is not ready');
    return;
  }
  navigationRef.dispatch(StackActions.push(name, params));
  requestAnimationFrame(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    const state = navigationRef.getRootState();
    const top = state.routes[state.routes.length - 1];
    if (top?.name !== name) {
      return;
    }
    // Mixing the existing full routes with a key-less partial route is valid
    // at runtime (reset rehydrates the payload, keeping existing keys and
    // generating the missing one), but ResetState can't express the mix.
    const routes = [
      ...state.routes.slice(0, -1),
      { name: underlay.name, params: underlay.params },
      top,
    ] as PartialState<NavigationState>['routes'];
    navigationRef.dispatch({
      ...CommonActions.reset({ index: routes.length - 1, routes }),
      target: state.key,
    });
  });
}

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
      resetRootAndClearCoveredComponents({
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
        screen: RootNames.GetStarted,
      });
      break;
    case 'resetTo':
      resetRootAndClearCoveredComponents({
        index: 0,
        routes: [
          {
            name: RootNames.StackGetStarted,
            state: {
              index: 0,
              routes: [{ name: RootNames.GetStarted }],
            },
          },
        ],
      });
      break;
    case 'push':
    default:
      navigateDeprecated(RootNames.StackGetStarted, {
        screen: RootNames.GetStarted,
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
