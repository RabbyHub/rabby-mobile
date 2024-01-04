const { Duplex } = require('readable-stream');

const noop = () => undefined;

export default class MobilePortStream extends Duplex {
  /**
   * Creates a stream that's both readable and writable.
   * The stream supports arbitrary objects.
   *
   * @class
   * @param {Object} port Remote Port object
   */
  constructor (port) {
    super({ objectMode: true });
    this._name = port.name;
    this._targetWindow = window;
    this._port = port;
    this._origin = location.origin;
    window.addEventListener('message', this._onMessage.bind(this), false);
  }

  _onMessage (event) {
    const msg = event.data;

    // validate message
    if (this._origin !== '*' && event.origin !== this._origin) {
      return;
    }
    if (!msg || typeof msg !== 'object') {
      return;
    }
    if (!msg.data || typeof msg.data !== 'object') {
      return;
    }
    if (msg.target && msg.target !== this._name) {
      return;
    }
    // Filter outgoing messages
    if (msg.data.data && msg.data.data.toNative) {
      return;
    }

    if (Buffer.isBuffer(msg)) {
      delete msg._isBuffer;
      const data = Buffer.from(msg);
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
  _onDisconnect () {
    this.destroy();
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
  _write (msg, _encoding, cb) {
    try {
      if (Buffer.isBuffer(msg)) {
        const data = msg.toJSON();
        data._isBuffer = true;
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ ...data, origin: window.location.href }),
        );
      } else {
        if (msg.data) {
          msg.data.toNative = true;
        }
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ ...msg, origin: window.location.href }),
        );
      }
    } catch (err) {
      return cb(new Error('MobilePortStream - disconnected'));
    }
    return cb();
  };
}

