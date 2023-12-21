import { EventEmitter } from 'events'

export class RNEventEmitter extends EventEmitter {
  /**
   * @fix this's no `off` method on EventEmitter on react-native
   *
   */
  off (...[event, listener]: Parameters<this['removeListener']>) {
    return this.removeListener(event, listener);
  }
}
