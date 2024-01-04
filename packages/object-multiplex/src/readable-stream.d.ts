// import indirectly used for module augmentation to extend @types/readable-stream with missing exports
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as readableStream from 'readable-stream';

interface Options {
  readable?: boolean | undefined;
  writable?: boolean | undefined;
  error?: boolean | undefined;
}
type Stream = NodeJS.ReadableStream | NodeJS.WritableStream;
type Callback = (error?: Error | null) => void;

declare module 'readable-stream' {
  function finished(
    stream: Stream,
    options: Options,
    callback?: Callback,
  ): () => void;

  const pipeline: typeof import('stream')['pipeline'];
}
