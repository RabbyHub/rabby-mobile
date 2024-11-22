import EventEmitter from 'events';
import type { Account } from './preference';

type Listener = (resp?: any) => void;

function makeJsEEClass<Listeners extends Record<string, Listener>>() {
  type EE = typeof EventEmitter & {
    on<T extends keyof Listeners>(
      eventType: T,
      listener: Listeners[T],
      context?: Object,
    ): void;
    emit<T extends keyof Listeners>(
      eventType: T,
      ...args: Parameters<Listeners[T]>
    ): void;
  };

  return { EventEmitter: EventEmitter as EE };
}

const { EventEmitter: AppServiceEvents } = makeJsEEClass<{
  currentAccountChanged: (account: Account) => void;
}>();

export const appServiceEvents = new AppServiceEvents();
