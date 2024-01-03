import Through from 'through2';
import ObjectMultiplex from '@rabby-wallet/object-multiplex';
import pump from 'pump';
// import pump from './pump';

/**
 * @description Returns a stream transform that parses JSON strings passing through
 */
function jsonParseStream() {
  return Through.obj(function (serialized, _, cb) {
    this.push(JSON.parse(serialized));
    cb();
  });
}

/**
 * @description Returns a stream transform that calls {@code JSON.stringify}
 * on objects passing through
 */
function jsonStringifyStream() {
  return Through.obj(function (obj, _, cb) {
    this.push(JSON.stringify(obj));
    cb();
  });
}

/**
 * @description Sets up stream multiplexing for the given stream
 */
function setupMultiplex(connectionStream: any) {
  const mux = new ObjectMultiplex();
  pump(connectionStream, mux, connectionStream, (err: any) => {
    if (err) {
      console.warn(err);
    }
  });
  // return mux as import('stream').Stream;
  return mux;
}

export { jsonParseStream, jsonStringifyStream, setupMultiplex };
