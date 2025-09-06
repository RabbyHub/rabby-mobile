import { NativeModuleNames } from './specs/types';
import {
  EventEmitterRecordToListeners,
  makeRnEEClass,
  resolveNativeModule,
} from './utils';

const { RNTimeChanged: nativeModule } = resolveNativeModule(
  NativeModuleNames.RNTimeChanged,
);

type Listeners = EventEmitterRecordToListeners<
  import('./specs/NativeRNTimeChanged').EventEmitterRecord
>;
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const eventEmitter = new NativeEventEmitter(nativeModule);

function makeDefaultHandler<T extends keyof Listeners>(fn: Listeners[T]) {
  if (typeof fn !== 'function') {
    console.error(
      'RNTimeChanged: addListener requires valid callback function',
    );

    return {
      remove: (): void => {
        console.error(
          'RNTimeChanged: remove not work because addListener requires valid callback function',
        );
      },
    };
  }
}

function subscribeTimeChanged(fn: Listeners['onTimeChanged']) {
  const handler = makeDefaultHandler<'onTimeChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('onTimeChanged', fn);
}

const RNTimeChanged = Object.freeze({
  exitAppForSecurity: nativeModule.exitAppForSecurity,
  subscribeTimeChanged,
});

export default RNTimeChanged;
