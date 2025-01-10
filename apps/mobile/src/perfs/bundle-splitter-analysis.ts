import { investigate } from 'react-native-bundle-splitter/dist/utils';

if (__DEV__) {
  const inves = investigate();
  console.debug('Bundle Info: ', {
    loaded: inves.loaded.length,
    waiting: inves.waiting.length,
  });
}
