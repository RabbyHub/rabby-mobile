import { NativeModules, DeviceEventEmitter } from 'react-native';
import { makeRnEEClass } from './event';
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
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
export const threadSelfEE = new NativeEventEmitter(ThreadSelfModule);

threadSelfEE.addListener('msgToThread', message => {
  if (__DEV__) {
    ThreadSelf.postMessage({
      type: '@notifyReceivedReq',
      data: message,
    });
  }
});
