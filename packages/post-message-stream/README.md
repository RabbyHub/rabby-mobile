# @rabby-wallet/post-message-stream

Originally forked from [MetaMask/post-message-stream](https://www.npmjs.com/package/@metamask/post-message-stream), Thx to [MetaMask](https://metamask.io).

=============================================================

A Node.js duplex stream interface over various kinds of JavaScript inter-"process" communication channels, for Node.js and the Web.
Originally the only communication channel used was `window.postMessage()`, but the package has since expanded in scope.

## Usage (Node.js)

### `ProcessParentMessageStream` and `ProcessMessageStream`

Node.js [`child_process.fork()`](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options) streams.
The parent process creates a child process with a dedicated IPC channel using `child_process.fork()`.

In the parent process:

```javascript
import { fork } from 'child_process';
import { ProcessParentMessageStream } from '@rabby-wallet/post-message-stream';

// `modulePath` is the path to the JavaScript module that will instantiate the
// child stream.
const process = fork(modulePath);

const parentStream = new ProcessParentMessageStream({ process });
parentStream.write('hello');
```

In the child process:

```javascript
import { ProcessMessageStream } from '@rabby-wallet/post-message-stream';

// The child stream automatically "connects" to the dedicated IPC channel via
// properties on `globalThis.process`.
const childStream = new ProcessMessageStream();
childStream.on('data', (data) => console.log(data + ', world'));
// > 'hello, world'
```

### `ThreadParentMessageStream` and `ThreadMessageStream`

Node.js [`worker_threads`](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options) streams.
The parent process creates a worker thread using `new worker_threads.Worker()`.

In the parent environment:

```javascript
import { Worker } from 'worker_threads';
import { ThreadParentMessageStream } from '@rabby-wallet/post-message-stream';

// `modulePath` is the path to the JavaScript module that will instantiate the
// child stream.
const thread = new Worker(modulePath);

const parentStream = new ThreadParentMessageStream({ thread });
parentStream.write('hello');
```

In the child thread:

```javascript
import { ThreadMessageStream } from '@rabby-wallet/post-message-stream';

// The child stream automatically "connects" to the parent via
// `worker_threads.parentPort`.
const childStream = new ThreadMessageStream();
childStream.on('data', (data) => console.log(data + ', world'));
// > 'hello, world'
```

## Usage (Web)

### `WebWorkerParentPostMessageStream` and `WebWorkerPostMessageStream`

These streams are intended for **dedicated** [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) only.
They might sort-of work with shared workers, but attempt that at your own risk.

In the parent window:

```javascript
import { WebWorkerParentPostMessageStream } from '@rabby-wallet/post-message-stream';

const worker = new Worker(url);

const parentStream = new WebWorkerParentPostMessageStream({ worker });
parentStream.write('hello');
```

In the child `WebWorker`:

```javascript
import { WebWorkerPostMessageStream } from '@rabby-wallet/post-message-stream';

const workerStream = new WebWorkerPostMessageStream();
workerStream.on('data', (data) => console.log(data + ', world'));
// > 'hello, world'
```

### `WindowPostMessageStream`

If you have two windows, A and B, that can communicate over `postMessage`, set up a stream in each.
Be sure to make use of the `targetOrigin` and `targetWindow` parameters to ensure that you are communicating with your intended subject.

In window A, with URL `https://foo.com`, trying to communicate with an iframe, `iframeB`:

```javascript
import { WindowPostMessageStream } from '@rabby-wallet/post-message-stream';

const streamA = new WindowPostMessageStream({
  name: 'streamA', // We give this stream a name that the other side can target.

  target: 'streamB', // This must match the `name` of the other side.

  // Adding `targetWindow` below already ensures that we will only _send_
  // messages to `iframeB`, but we need to specify its origin as well to ensure
  // that we only _receive_ messages from `iframeB`.
  targetOrigin: new URL(iframeB.src).origin,

  // We have to specify the content window of `iframeB` as the target, or it
  // won't receive our messages.
  targetWindow: iframeB.contentWindow,
});

streamA.write('hello');
```

In window B, running in an iframe accessible in window A:

```javascript
const streamB = new WindowPostMessageStream({
  // Notice that these values are reversed relative to window A.
  name: 'streamB',
  target: 'streamA',

  // The origin of window A. If we don't specify this, it would default to
  // `location.origin`, which won't work if the local origin is different. We
  // could pass `*`, but that's potentially unsafe.
  targetOrigin: 'https://foo.com',

  // We omit `targetWindow` here because it defaults to `window`.
});

streamB.on('data', (data) => console.log(data + ', world'));
// > 'hello, world'
```

#### Gotchas

Under the hood, `WindowPostMessageStream` uses `window.addEventListener('message', (event) => ...)`.
If `event.source` is not referentially equal to the stream's `targetWindow`, all messages will be ignored.
This can happen in environments where `window` objects are proxied, such as Electron.

## Contributing

### Setup

- Install [Node.js](https://nodejs.org) version 12
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn v1](https://yarnpkg.com/en/docs/install)
- Run `yarn setup` to install dependencies and run any requried post-install scripts
  - **Warning:** Do not use the `yarn` / `yarn install` command directly. Use `yarn setup` instead. The normal install command will skip required post-install scripts, leaving your development environment in an invalid state.

### Testing and Linting

Run `yarn test` to run the tests once. To run tests on file changes, run `yarn test:watch`.

Run `yarn lint` to run the linter, or run `yarn lint:fix` to run the linter and fix any automatically fixable issues.
