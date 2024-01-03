import {
  setJSExceptionHandler,
  setNativeExceptionHandler,
} from 'react-native-exception-handler';
setJSExceptionHandler((error, isFatal) => {
  console.debug('setJSExceptionHandler:: error', error);
}, true);

ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.debug('setGlobalHandler:: error', error);
});

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
