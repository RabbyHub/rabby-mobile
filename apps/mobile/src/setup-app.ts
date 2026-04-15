import '@exodus/patch-broken-hermes-typed-arrays';
import { setJSExceptionHandler } from 'react-native-exception-handler';
import { logger } from '@/utils/logger';
import './perfs/bundle-splitter-analysis.ts';
import './devtools/e2eBridge';
import './databases/orm';
import './core/services';
import './core/utils/devServerSettings';
import './core/config/online';

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
