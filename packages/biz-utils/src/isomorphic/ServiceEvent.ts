import EventEmitter from "events";

export default class ServiceEvent<T extends string = string> {
  private emitter = new EventEmitter();

  on(event: T, listener: (...args: any[]) => void) {
    this.emitter.on(event, listener);
  }

  once(event: T, listener: (...args: any[]) => void) {
    this.emitter.once(event, listener);
  }

  off(event: T, listener: (...args: any[]) => void) {
    this.emitter.off(event, listener);
  }

  emit(event: T, ...args: any[]) {
    this.emitter.emit(event, ...args);
  }

  removeAllListeners(event: T) {
    this.emitter.removeAllListeners(event);
  }

  removeAll() {
    this.emitter.removeAllListeners();
  }
}
