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

  emit<T extends keyof Listeners & string>(
    eventType: T,
    ...args: Parameters<Listeners[T]>
  ): boolean;
}

export function makeJsEEClass<
  Listeners extends {
    [key: string]: Listener;
  },
>() {
  return { EventEmitter: EventEmitter as typeof BizEventEmitter<Listeners> };
}

const { EventEmitter: AppServiceEvents } = makeJsEEClass<{
  currentAccountChanged: (account: Account) => void;
}>();

export const appServiceEvents = new AppServiceEvents();
