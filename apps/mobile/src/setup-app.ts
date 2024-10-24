import '@exodus/patch-broken-hermes-typed-arrays';
import {
  setJSExceptionHandler,
  setNativeExceptionHandler,
} from 'react-native-exception-handler';
import { initSentry } from './core/sentry';
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
