import { Duplex, finished } from 'readable-stream';
import once from 'once';
import { Substream } from './Substream';

const IGNORE_SUBSTREAM = Symbol('IGNORE_SUBSTREAM');

interface Chunk {
  name: string;
  data: unknown;
}

export class ObjectMultiplex extends Duplex {
  private _substreams: Record<string, Substream | typeof IGNORE_SUBSTREAM>;

  constructor(opts: Record<string, unknown> = {}) {
    super({
      ...opts,
      objectMode: true,
    });
    this._substreams = {};
  }

  createStream(name: string): Substream {
    // guard stream against destroyed already
    if (this.destroyed) {
      throw new Error(
        `ObjectMultiplex - parent stream for name "${name}" already destroyed`,
      );
    }

    // guard stream against ended already
    if (this._readableState.ended || this._writableState.ended) {
      throw new Error(
        `ObjectMultiplex - parent stream for name "${name}" already ended`,
      );
    }

    // validate name
    if (!name) {
      throw new Error('ObjectMultiplex - name must not be empty');
    }

    if (this._substreams[name]) {
      throw new Error(
        `ObjectMultiplex - Substream for name "${name}" already exists`,
      );
    }

    // create substream
    const substream = new Substream({ parent: this, name });
    this._substreams[name] = substream;

    // listen for parent stream to end
    anyStreamEnd(this, (_error?: Error | null) => {
      return substream.destroy(_error || undefined);
    });

    return substream;
  }

  // ignore streams (dont display orphaned data warning)
  ignoreStream(name: string): void {
    // validate name
    if (!name) {
      throw new Error('ObjectMultiplex - name must not be empty');
    }
    if (this._substreams[name]) {
      throw new Error(
        `ObjectMultiplex - Substream for name "${name}" already exists`,
      );
    }
    // set
    this._substreams[name] = IGNORE_SUBSTREAM;
  }

  _read(): void {
    return undefined;
  }

  _write(
    chunk: Chunk,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const { name, data } = chunk;

    if (!name) {
      console.warn(`ObjectMultiplex - malformed chunk without name, chunk data:`);
      console.warn(JSON.stringify(chunk));
      return callback();
    } else {
      // // dev only
      // console.warn(`ObjectMultiplex - chunk received, chunk data:`);
      // console.log(JSON.stringify(chunk));
    }

    // get corresponding substream
    const substream = this._substreams[name];
    if (!substream) {
      console.warn(`ObjectMultiplex - orphaned data for stream "${name}"`);
      return callback();
    }

    // push data into substream
    if (substream !== IGNORE_SUBSTREAM) {
      substream.push(data);
    }

    return callback();
  }
}

// util
function anyStreamEnd(
  stream: ObjectMultiplex,
  _cb: (error?: Error | null) => void,
) {
  const cb = once(_cb);
  finished(stream, { readable: false }, cb);
  finished(stream, { writable: false }, cb);
}
