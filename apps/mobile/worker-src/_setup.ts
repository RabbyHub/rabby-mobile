import Reactotron from 'reactotron-react-native';
import { ThreadSelf } from './utils/ThreadSelf';

declare global {
  interface Console {
    tron?: typeof Reactotron;
  }
}

// if (__DEV__) {
//   Reactotron.configure({
//     getClientId: async () => `RabbyMobileThread`,
//     name: 'Rabby Mobile Thread',
//   })
//     .useReactNative()
//     .connect();

//   console.tron = Reactotron;
// }

setInterval(() => {
  ThreadSelf.postMessage({
    type: 'ack',
    time: Date.now(),
  });
}, 3000);

ErrorUtils.setGlobalHandler((error, isFatal) => {
  ThreadSelf.postMessage({
    type: `@catchedError`,
    error: error,
    scene: 'ErrorUtils.setGlobalHandler',
    isFatal,
  });
});

global.addEventListener?.('error', event => {
  console.error('Global error caught:', event.error);
  ThreadSelf.postMessage({
    type: `@catchedError`,
    error: event.error,
    scene: 'global.addEventListener.error',
    isFatal: true,
  });
});

global.addEventListener?.('unhandledrejection', event => {
  console.error('Unhandled rejection:', event.reason);
  ThreadSelf.postMessage({
    type: `@catchedError`,
    error: event.reason,
    scene: 'global.addEventListener.unhandledrejection',
    isFatal: true,
  });
});
