import 'sinon';
import { PassThrough, Stream, Transform, pipeline } from 'readable-stream';
import { ObjectMultiplex } from './ObjectMultiplex';


test('basic - string', (done) => {
  const { inTransport, inStream, outStream } = basicTestSetup();
  bufferToEnd(outStream, (err, results) => {
    // should not error
    expect(err).toBeUndefined();
    // results should match
    expect(results).toEqual(['haay', 'wuurl']);
    done();
  });

  // pass in messages
  inStream.write('haay');
  inStream.write('wuurl');

  // simulate disconnect
  setImmediate(() => {
    inTransport.end(null, () => undefined);
  });
});

test('basic - obj', (done) => {
  const { inTransport, inStream, outStream } = basicTestSetup();
  bufferToEnd(outStream, (err, results) => {
    expect(err).toBeUndefined();
    expect(results).toEqual(
      [{ message: 'haay' }, { message: 'wuurl' }],
    );

    done();
  });
  // pass in messages
  inStream.write({ message: 'haay' });
  inStream.write({ message: 'wuurl' });

  // simulate disconnect
  setImmediate(() => inTransport.end(null, () => undefined));
});

test.only('roundtrip', (done) => {
  const { outTransport, inStream, outStream } = basicTestSetup();
  const doubler = new Transform({
    objectMode: true,
    transform(chunk, _end, callback) {
      const result = chunk * 2;
      callback(null, result);
    },
  });

  pipeline(outStream, doubler, outStream, () => undefined);

  bufferToEnd(inStream, (err, results) => {
    expect(err).toBeUndefined();
    expect(results).toEqual([20, 24]);
    done();
  });
  // pass in messages
  inStream.write(10);
  inStream.write(12);

  // simulate disconnect
  setTimeout(() => outTransport.end(), 100);
});

test('error on createStream if destroyed', (done) => {
  const stream = new ObjectMultiplex();
  stream.destroy();
  try {
    stream.createStream('controller');
  } catch (e: any) {
    expect(e.message.includes('already destroyed')).toBe(true);
    done();
  }
});

test('error on createStream if ended', (done) => {
  const stream = new ObjectMultiplex();
  stream.end();
  try {
    stream.createStream('controller');
  } catch (e: any) {
    expect(e.message.includes('already ended')).toBe(true);
    done();
  }
});

// util
function logEvents(name: string, stream: Stream) {
  stream.on('close', () => console.log(`stream ${name} closed`));
  stream.on('finish', () => console.log(`stream ${name} finished`));
  stream.on('end', () => console.log(`stream ${name} ended`));
}

function basicTestSetup() {
  // setup multiplex and Transport
  const inMux = new ObjectMultiplex();
  const outMux = new ObjectMultiplex();
  const inTransport = new PassThrough({ objectMode: true });
  const outTransport = new PassThrough({ objectMode: true });

  // setup substreams
  const inStream = inMux.createStream('hello');
  const outStream = outMux.createStream('hello');

  // logEvents('inMux', inMux);
  // logEvents('outMux', outMux);
  // logEvents('inTransport', inTransport);
  // logEvents('outTransport', outTransport);
  // logEvents('inStream', inStream);
  // logEvents('outStream', outStream);

  pipeline(inMux, inTransport, outMux, outTransport, inMux, (err) => {
    console.log('pipeline lost connection');
    if (err) {
      console.error(err);
    }
  });

  return {
    inTransport,
    outTransport,
    inMux,
    outMux,
    inStream,
    outStream,
  };
}

function bufferToEnd(stream: Stream, callback: (err: Error | null, results: any[]) => void) {
  const results: any[] = [];
  let flushed = false;
  function onFinish(err: Error | null) {
    if (flushed) {
      return;
    }
    flushed = true;
    callback(err, results);
  }
  // cleanup of stream should be called at end of each stream
  // this ensures that
  stream.prependListener('close', onFinish);
  stream.on('data', (chunk) => {
    results.push(chunk);
  });
}
