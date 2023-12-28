# `@rabby-wallet/rn-webview-bridge`

A sample package.

## Installation

`yarn add @rabby-wallet/rn-webview-bridge`

or

`npm install @rabby-wallet/rn-webview-bridge`

## APIs

### BackgroundBridges

```js
  const notifyAllConnections = useCallback((payload, restricted = true) => {
    const fullHostname = new URL(url.current).hostname;

    // TODO:permissions move permissioning logic elsewhere
    backgroundBridges.current.forEach((bridge) => {
      if (bridge.hostname === fullHostname) {
        bridge.sendNotification(payload);
      }
    });
  }, []);
```


## Contributing

This package is part of a monorepo. Instructions for contributing can be found in the [monorepo README](https://github.com/RabbyHub/core#readme).
