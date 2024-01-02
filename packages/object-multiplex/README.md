# @rabby-wallet/object-multiplex

Simple stream multiplexing for `objectMode`.

## Usage

```js
// create multiplexer
const mux = new ObjMultiplex();

// setup substreams
const streamA = mux.createStream("hello");
const streamB = mux.createStream("world");

// pipe over transport (and back)
mux.pipe(transport).pipe(mux);

// send values over the substreams
streamA.write({ thisIsAn: "object" });
streamA.write(123);

// or pipe together normally
streamB.pipe(evilAiBrain).pipe(streamB);
```

## Contributing

### Setup

- Install [Node.js](https://nodejs.org) version 18
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn v1](https://yarnpkg.com/en/docs/install)
- Run `yarn setup` to install dependencies and run any requried post-install scripts
  - **Warning:** Do not use the `yarn` / `yarn install` command directly. Use `yarn setup` instead. The normal install command will skip required post-install scripts, leaving your development environment in an invalid state.

### Testing and Linting

Run `yarn test` to run the tests once.

Run `yarn lint` to run the linter, or run `yarn lint:fix` to run the linter and fix any automatically fixable issues.
