import { urlUtils } from '@rabby-wallet/base-utils';
import { Buffer } from 'buffer';
import { Duplex } from 'readable-stream';

// eslint-disable-next-line no-empty-function
const noop = () => {};

export default class PortDuplexStream extends Duplex {
  constructor(port, urlRef) {
    super({
      objectMode: true,
    });
    this._port = port;
    this._urlRef = urlRef;
    this._port.addListener('message', this._onMessage.bind(this));
    this._port.addListener('disconnect', this._onDisconnect.bind(this));
  }

  /**
   * Callback triggered when a message is received from
   * the remote Port associated with this Stream.
   *
   * @private
   * @param {Object} msg - Payload from the onMessage listener of Port
   */
  _onMessage = function (msg) {
    if (Buffer.isBuffer(msg)) {
      delete msg._isBuffer;
      const data = new Buffer(msg);
      this.push(data);
    } else {
      this.push(msg);
    }
  };

  /**
   * Callback triggered when the remote Port
   * associated with this Stream disconnects.
   *
   * @private
   */
  _onDisconnect = function () {
    this.destroy && this.destroy();
  };

  /**
   * Explicitly sets read operations to a no-op
   */
  _read = noop;

  /**
   * Called internally when data should be written to
   * this writable stream.
   *
   * @private
   * @param {*} msg Arbitrary object to write
   * @param {string} encoding Encoding to use when writing payload
   * @param {Function} cb Called when writing is complete or an error occurs
   */
  _write = function (msg, encoding, cb) {
    try {
      const targetOrigin = urlUtils.safeGetOrigin(this._urlRef.current).origin;
      if (Buffer.isBuffer(msg)) {
        const data = msg.toJSON();
        data._isBuffer = true;
        this._port.postMessage(data, targetOrigin);
      } else {
        this._port.postMessage(msg, targetOrigin);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('PortDuplexStream - Error writing to port:', err);
      }
      return cb(new Error('PortDuplexStream - disconnected'));
    }
    cb();
  };
}
