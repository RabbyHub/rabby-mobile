import EventEmitter from 'events';
import type { Account } from './preference';

type Listener = (resp?: any) => void;

declare class BizEventEmitter<
  Listeners extends { [key: string]: Listener },
> extends EventEmitter {
  on<T extends keyof Listeners & string>(
    eventType: T,
    listener: Listeners[T],
  ): this;

  off<T extends keyof Listeners & string>(
    eventType: T,
    listener: Listeners[T],
  ): this;

  emit<T extends keyof Listeners & string>(
    eventType: T,
    ...args: Parameters<Listeners[T]>
  ): boolean;

  subscribe<T extends keyof Listeners & string>(
    type: T,
    listener: Listeners[T],
  ): { remove: () => void };
}

export function makeJsEEClass<
  Listeners extends {
    [key: string]: Listener;
  },
>() {
  class EE extends EventEmitter {
    subscribe<T extends keyof Listeners & string>(
      type: T,
      listener: Listeners[T],
    ) {
      super.addListener(type, listener);

      const unsub = () => {
        super.removeListener(type, listener);
      };

      return { remove: unsub };
    }
  }

  return { EventEmitter: EE as typeof BizEventEmitter<Listeners> };
}

const { EventEmitter: AppServiceEvents } = makeJsEEClass<{
  currentAccountChanged: (account: Account) => void;
}>();

export const appServiceEvents = new AppServiceEvents();
