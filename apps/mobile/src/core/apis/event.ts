import EventEmitter from 'events';

type Listener = (...args: any[]) => void;
export function makeEEClass<Listeners extends Record<string, Listener>>() {
  class EE extends EventEmitter {
    addListener<T extends keyof Listeners & string>(
      eventType: T,
      listener: Listeners[T],
    ) {
      return super.on(eventType, listener);
    }
    on<T extends keyof Listeners & string>(
      eventType: T,
      listener: Listeners[T],
    ) {
      return super.on(eventType, listener);
    }
    once<T extends keyof Listeners & string>(
      eventType: T,
      listener: Listeners[T],
    ) {
      return super.once(eventType, listener);
    }
    emit<T extends keyof Listeners & string>(
      eventType: T,
      ...args: Parameters<Listeners[T]>
    ) {
      return super.emit(eventType, ...args);
    }
  }

  return { EventEmitter: EE };
}
