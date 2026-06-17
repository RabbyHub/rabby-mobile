import { jsonResponse } from './workmsg';

type EmitterSubscription = {
  remove(): void;
};

type ThreadSelfEventEmitter = {
  addListener<TEvent extends keyof Listeners & string>(
    eventType: TEvent,
    listener: Listeners[TEvent],
  ): EmitterSubscription;
};

const nativeModulesImport = require('react-native/Libraries/BatchedBridge/NativeModules');
const NativeModules = nativeModulesImport.default ?? nativeModulesImport;

const rctDeviceEventEmitterImport = require('react-native/Libraries/EventEmitter/RCTDeviceEventEmitter');
const RCTDeviceEventEmitter =
  rctDeviceEventEmitterImport.default ?? rctDeviceEventEmitterImport;

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
export const threadSelfEE: ThreadSelfEventEmitter = RCTDeviceEventEmitter;

threadSelfEE.addListener('msgToThread', message => {
  if (__DEV__) {
    ThreadSelf.postMessage({
      type: '@notifyReceivedReq',
      data: message,
    });
  }
});
