import { makeRnEEClass, resolveNativeModule } from './utils';

const { RNHelpers: nativeModule } = resolveNativeModule('RNHelpers');

type Listeners = {};
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const eventEmitter = new NativeEventEmitter(nativeModule);

function makeDefaultHandler<T extends keyof Listeners>(fn: Listeners[T]) {
  if (typeof fn !== 'function') {
    console.error('RNHelpers: addListener requires valid callback function');

    return {
      remove: (): void => {
        console.error(
          'RNHelpers: remove not work because addListener requires valid callback function',
        );
      },
    };
  }
}

const RNHelpers = Object.freeze({
  ...nativeModule,
});

export default RNHelpers;
