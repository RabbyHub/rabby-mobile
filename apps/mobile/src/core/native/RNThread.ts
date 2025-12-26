/// <reference path="../../../worker-src/worker-duplex.d.ts" />

import { EmitterSubscription } from 'react-native';

import { makeRnEEClass, resolveNativeModule } from './utils';
import { stringUtils } from '@rabby-wallet/base-utils';
import { sleep } from '@/utils/async';

const { RNThread } = resolveNativeModule('RNThread');

type Listeners = {
  msgFromThread: (payload: { tid: number; message: string }) => any;
  DevThreadMessage: (payload?: { tid: number; message: string }) => any;
  '@ThreadStarted': (payload?: { tid: number }) => any;
  // '@ThreadError': (payload?: { tid: number; errorCode?: string; errorMessage?: string }) => any;
  '@ThreadStopped': (payload?: { tid: number }) => any;
};
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const eventEmitter = new NativeEventEmitter(RNThread);

function parseResponse(message: string): WorkerDuplexReceive | null {
  return stringUtils.safeParseJSON(message, { defaultValue: null });
}

function waitNextThread() {
  return new Promise<number>(resolve => {
    const sub = eventEmitter.addListener('@ThreadStarted', payload => {
      sub.remove();
      resolve(payload.tid);
    });
  });
}

type MsgHandler = (message: WorkerDuplexReceive) => void;

export const ThreadError = {
  Timeout: 'Timeout',
};

export class Thread {
  #id: Promise<number> = waitNextThread();

  #running = false;

  get isRunning() {
    return this.#running;
  }

  #jsPath: string;
  private _subs: EmitterSubscription[] = [];

  constructor(jsPath: string) {
    if (!jsPath || !jsPath.endsWith('.js')) {
      throw new Error('Invalid path for thread. Only js files are supported');
    }

    this.#jsPath = jsPath;
  }

  addListener<K extends keyof Listeners & `@${string}`>(
    eventType: K,
    listener: Listeners[K],
  ) {
    return eventEmitter.addListener(eventType, listener);
  }

  #internal_addListener<K extends keyof Listeners>(
    eventType: K,
    listener: Listeners[K],
  ) {
    const sub = eventEmitter.addListener(eventType, listener);
    this._subs.push(sub);
    return sub;
  }

  async remoteCall<K extends WorkerDuplexPost['type']>(
    type: K,
    msg?: Omit<Extract<WorkerDuplexPost, { type: K }>, 'type' | 'reqid'>,
    options?: { timeout?: number },
  ) {
    const reqid = stringUtils.randString();
    const { timeout = 1e3 * 10 } = options || {};

    const waitResult = new Promise<WorkerDuplexReceiveDict[K]['data']>(
      (resolve, reject) => {
        const sub = this.onThreadMessage(message => {
          if (message.type === `response:${type}` && message.reqid === reqid) {
            console.debug(
              '[perf] remoteCall::response type, message, reqid',
              type,
              message,
              reqid,
            );
            resolve(message.data);
            sub.remove();
          }
        });
        sleep(timeout).then(() => {
          reject(new Error(ThreadError.Timeout));
          sub.remove();
        });
      },
    );

    this.#id?.then(id => {
      return RNThread.postThreadMessage(
        id,
        JSON.stringify(Object.assign({ reqid, type }, msg)),
      );
    });

    return waitResult;
  }

  #_resetSubs() {
    this._subs.forEach(sub => sub.remove());
    this._subs = [];
  }

  #_threadMsgSubscriber = new Set<MsgHandler>();
  onThreadMessage(listener: (message: WorkerDuplexReceive) => void) {
    this.#_threadMsgSubscriber.add(listener);
    const remove = () => {
      this.#_threadMsgSubscriber.delete(listener);
    };

    return { remove };
  }

  async start() {
    return (this.#id = RNThread.startThread(this.#jsPath.replace('.js', ''), {
      // ...(__DEV__ && { usePackedResource: true }),
    })
      .then(id => {
        console.debug('RNThread running with id', id);
        this.#running = true;
        this.#internal_addListener('msgFromThread', payload => {
          // console.debug('id-Thread RNThread received payload:', payload);
          if (payload.tid !== id) return;

          const parseResponsed = parseResponse(payload.message);
          if (!parseResponsed) {
            if (!__DEV__) {
              console.warn(
                'id-Thread RNThread received invalid message:',
                payload.message,
              );
            } else {
              // TODO: report to Sentry
              throw new Error(
                'id-Thread RNThread received invalid message: ' +
                  payload.message,
              );
            }
          } else {
            this.#_threadMsgSubscriber.forEach(fn => {
              parseResponsed && fn?.(parseResponsed);
            });
          }
        });
        return id;
      })
      .catch(err => {
        throw new Error(err);
      }));
  }

  async terminate() {
    const p = this.#id?.then(RNThread.stopThread).then(() => {
      this.#running = false;
      this.#id = waitNextThread();
    });
    this.#_resetSubs();
    return p;
  }

  async restart() {
    await this.terminate();
    return this.start();
  }
}
