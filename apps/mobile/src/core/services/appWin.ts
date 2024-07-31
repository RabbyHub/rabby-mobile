import { makeEEClass } from '../apis/event';

import type {
  createGlobalBottomSheetModal,
  globalBottomSheetModalAddListener,
  presentGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';

type Nextor<Return = any> = {
  (err: Error | null, ret?: Return): void;
};
type Func = (...args: any[]) => any;
export type WrapNextor<T extends Func> = T extends (...args: infer P) => infer R
  ? (nextor: Nextor<R>, ...args: P) => void
  : never;
export type UnWrapNextor<T extends Func> = T extends WrapNextor<infer U>
  ? U
  : never;

type Listeners = {
  createGlobalBottomSheetModal: ReturnType<
    typeof makeAsyncCallWrapper<typeof createGlobalBottomSheetModal>
  >;
  globalBottomSheetModalAddListener: ReturnType<
    typeof makeAsyncCallWrapper<typeof globalBottomSheetModalAddListener>
  >;
  presentGlobalBottomSheetModal: ReturnType<
    typeof makeAsyncCallWrapper<typeof presentGlobalBottomSheetModal>
  >;
  removeGlobalBottomSheetModal: ReturnType<
    typeof makeAsyncCallWrapper<typeof removeGlobalBottomSheetModal>
  >;
};
const { EventEmitter: AppWinEventEmitter } = makeEEClass<Listeners>();

class EE extends AppWinEventEmitter {
  static inst = new EE();
  async createGlobalBottomSheetModal(
    ...args: Parameters<typeof createGlobalBottomSheetModal>
  ) {
    type R = null | ReturnType<typeof createGlobalBottomSheetModal>;
    const promise = new Promise<R>((resolve, reject) => {
      const nextor: Nextor<R> = (err, ret) => {
        if (err) {
          reject(err);
        } else {
          resolve(ret ?? null);
        }
      };
      super.emit('createGlobalBottomSheetModal', nextor, ...args);
    });

    return promise;
  }
  async globalBottomSheetModalAddListener(
    ...args: Parameters<typeof globalBottomSheetModalAddListener>
  ) {
    type R = null | ReturnType<typeof globalBottomSheetModalAddListener>;
    const promise = new Promise<R>((resolve, reject) => {
      const nextor: Nextor<R> = (err, ret) => {
        if (err) {
          reject(err);
        } else {
          resolve(ret ?? null);
        }
      };
      super.emit('globalBottomSheetModalAddListener', nextor, ...args);
    });

    return promise;
  }
  async presentGlobalBottomSheetModal(
    ...args: Parameters<typeof presentGlobalBottomSheetModal>
  ) {
    type R = null | ReturnType<typeof presentGlobalBottomSheetModal>;
    const promise = new Promise<R>((resolve, reject) => {
      const nextor: Nextor<R> = (err, ret) => {
        if (err) {
          reject(err);
        } else {
          resolve(ret ?? null);
        }
      };
      super.emit('presentGlobalBottomSheetModal', nextor, ...args);
    });

    return promise;
  }
  async removeGlobalBottomSheetModal(
    ...args: Parameters<typeof removeGlobalBottomSheetModal>
  ) {
    type R = null | ReturnType<typeof removeGlobalBottomSheetModal>;
    const promise = new Promise<R>((resolve, reject) => {
      const nextor: Nextor<R> = (err, ret) => {
        if (err) {
          reject(err);
        } else {
          resolve(ret ?? null);
        }
      };
      super.emit('removeGlobalBottomSheetModal', nextor, ...args);
    });

    return promise;
  }
}

export const appWinCaller = EE.inst;

export function makeAsyncCallWrapper<T extends Func>(fn: T) {
  const eventCall = async (
    nextor: Nextor<ReturnType<T>>,
    ...args: Parameters<T>
  ) => {
    try {
      const ret = await fn(...args);
      nextor(null, ret);
    } catch (err: any) {
      nextor(err, undefined);
    }
  };

  return eventCall;
}
