import NativeModules from 'react-native/Libraries/BatchedBridge/NativeModules';
import DeviceEventEmitter from 'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter';
import { jsonResponse } from './workmsg';

const { ThreadSelfModule } = NativeModules;
export const ThreadSelf = {
  postRawMessage(message: string) {
    return ThreadSelfModule.postMessage(message);
  },

  postMessage(message: WorkerDuplexReceive) {
    return ThreadSelfModule.postMessage(jsonResponse(message));
  },
};

type Listeners = {
  msgToThread: (payload?: any) => any;
};
// The worker owns a minimal React context without UI packages. Native
// ThreadSelf messages are emitted through its global device event emitter.
export const threadSelfEE = DeviceEventEmitter as {
  addListener<T extends keyof Listeners & string>(
    eventType: T,
    listener: Listeners[T],
  ): { remove: () => void };
};

threadSelfEE.addListener('msgToThread', message => {
  if (__DEV__) {
    ThreadSelf.postMessage({
      type: '@notifyReceivedReq',
      data: message,
    });
  }
});
