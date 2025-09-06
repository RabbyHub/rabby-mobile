import '@exodus/patch-broken-hermes-typed-arrays';
import {
  setJSExceptionHandler,
  setNativeExceptionHandler,
} from 'react-native-exception-handler';
import { initSentry } from './core/sentry';
import './perfs/bundle-splitter-analysis.ts';
import './databases/orm';
import './core/services';
import './core/utils/fonts';
import './core/config/online';
import { FlatList } from 'react-native';

// @ts-expect-error
FlatList.defaultProps = Object.assign({}, FlatList.defaultProps, {
  /**
   * @see https://github.com/software-mansion/react-native-screens/issues/2339#issuecomment-2350979876
   * @see perf issue https://github.com/software-mansion/react-native-screens/issues/2339#issuecomment-3177692971
   */
  removeClippedSubviews: false,
});

setJSExceptionHandler((error, isFatal) => {
  console.debug('setJSExceptionHandler:: error');
  console.log(error);
}, true);

// setNativeExceptionHandler(
//   exceptionString => {
//     // your exception handler code here
//     console.debug(
//       'setNativeExceptionHandler:: exceptionString',
//       exceptionString,
//     );
//   },
//   !__DEV__,
//   true,
// );

ErrorUtils.setGlobalHandler((error, isFatal) => {
  // if (__DEV__) {
  //   console.debug('setGlobalHandler:: error');
  //   console.log(error);
  // }

  if (isFatal) {
    // WIP: alert on release mode?
  }
});

if (!__DEV__) {
  initSentry();
}
