import {
  setJSExceptionHandler,
  setNativeExceptionHandler,
} from 'react-native-exception-handler';
setJSExceptionHandler((error, isFatal) => {
  console.debug('setJSExceptionHandler:: error', error);
}, true);

setNativeExceptionHandler(
  exceptionString => {
    // your exception handler code here
    console.debug(
      'setNativeExceptionHandler:: exceptionString',
      exceptionString,
    );
  },
  !__DEV__,
  true,
);

ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (__DEV__) {
    console.debug('setGlobalHandler:: error', error);
  }

  if (isFatal) {
    // WIP: alert on release mode?
  }
});
