import '@exodus/patch-broken-hermes-typed-arrays';
import { setJSExceptionHandler } from 'react-native-exception-handler';
import { logger } from '@/utils/logger';
import './perfs/bundle-splitter-analysis';
import './devtools/e2eBridge';
import './databases/orm';
import './core/services';
import './core/utils/devServerSettings';
import './core/config/online';
import { FlatList } from 'react-native';

// @ts-expect-error React Native keeps this runtime defaultProps hook.
FlatList.defaultProps = Object.assign({}, FlatList.defaultProps, {
  /**
   * @see https://github.com/software-mansion/react-native-screens/issues/2339#issuecomment-2350979876
   * @see https://github.com/software-mansion/react-native-screens/issues/2339#issuecomment-3177692971
   */
  removeClippedSubviews: false,
});

setJSExceptionHandler((error, isFatal) => {
  logger.error('setJSExceptionHandler::error', {
    isFatal,
    error,
  });
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
  logger.error('setGlobalHandler::error', {
    isFatal,
    error,
  });

  if (isFatal) {
    // WIP: alert on release mode?
  }
});
