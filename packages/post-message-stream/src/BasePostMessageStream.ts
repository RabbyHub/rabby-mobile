import { Duplex } from 'readable-stream';
import { StreamData } from './utils';

const noop = () => undefined;

const SYN = 'SYN';
const ACK = 'ACK';

type Log = (data: unknown, out: boolean) => void;

export interface PostMessageEvent {
  data?: StreamData;
  origin: string;
  source: typeof window;
}

/**
 * Abstract base class for postMessage streams.
 */
export abstract class BasePostMessageStream extends Duplex {
  private _init: boolean;

  private _haveSyn: boolean;

  private _log: Log;

  constructor() {
    super({
      objectMode: true,
    });

    // Initialization flags
    this._init = false;
    this._haveSyn = false;
    this._log = () => null;
  }

  /**
   * Must be called at end of child constructor to initiate
   * communication with other end.
   */
  protected _handshake(): void {
    // Send synchronization message
    this._write(SYN, null, noop);
    this.cork();
  }

  protected _onData(data: StreamData): void {
    if (this._init) {
      // Forward message
      try {
        this.push(data);
        this._log(data, false);
      } catch (err) {
        this.emit('error', err);
      }
    } else if (data === SYN) {
      // Listen for handshake
      this._haveSyn = true;
      this._write(ACK, null, noop);
    } else if (data === ACK) {
      this._init = true;
      if (!this._haveSyn) {
        this._write(ACK, null, noop);
      }
      this.uncork();
    }
  }

  /**
   * Child classes must implement this function.
   */
  protected abstract _postMessage(_data?: unknown): void;

  _read(): void {
    return undefined;
  }

  _write(data: StreamData, _encoding: string | null, cb: () => void): void {
    if (data !== ACK && data !== SYN) {
      this._log(data, true);
    }
    this._postMessage(data);
    cb();
  }

  _setLogger(log: Log) {
    this._log = log;
  }
}
