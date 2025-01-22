import EventEmitter from 'events';
import type { Account } from './preference';

type Listener = (resp?: any) => void;

export function makeJsEEClass<
  Listeners extends {
    [key: string]: Listener;
  },
>() {
  type EE = typeof EventEmitter & {
    on<T extends keyof Listeners & string>(
      eventName: T,
      listener: Listeners[T],
      context?: Object,
    ): ThisType<EE>;
    emit<T extends keyof Listeners & string>(
      eventName: T,
      ...args: Parameters<Listeners[T]>
    ): boolean;
  };

  class BizEventEmitter extends EventEmitter {
    on<T extends keyof Listeners & string>(
      eventType: T,
      listener: Listeners[T],
      context?: Object,
    ) {
      return super.on(eventType, listener.bind(context));
    }

    emit<T extends keyof Listeners & string>(
      eventType: T,
      ...args: Parameters<Listeners[T]>
    ) {
      return super.emit(eventType, ...args);
    }
  }

  return { EventEmitter: BizEventEmitter };
}

const { EventEmitter: AppServiceEvents } = makeJsEEClass<{
  currentAccountChanged: (account: Account) => void;
}>();

export const appServiceEvents = new AppServiceEvents();
