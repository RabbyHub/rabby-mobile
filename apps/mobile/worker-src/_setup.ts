import './_polyfills';
import './_logging';
import { ThreadSelf } from './utils/ThreadSelf';

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
