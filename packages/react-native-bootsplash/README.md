# @rabby-wallet/react-native-bootsplash

Rabby-scoped runtime fork of
[`react-native-bootsplash`](https://github.com/zoontek/react-native-bootsplash),
based on version 7.3.2.

This package keeps the upstream MIT-licensed runtime and native modules. The
upstream CLI, Expo generator, asset generator, and commercial generator addon
are intentionally not included.

## Rabby extension

Android supports an application-owned launch layout while retaining the
BootSplash lifecycle:

```java
RNBootSplash.init(this, R.style.BootTheme, R.layout.launch_screen);
```

The custom layout is inflated into the native splash view and is removed by the
standard `hide()` API.

## Fork boundary

This is a runtime-only fork. It includes the JavaScript API, React Native
Codegen spec, and the Android and iOS native implementations.

The following upstream surfaces are intentionally excluded:

- commercial generator extras and their obfuscated payloads;
- the asset generator and command-line entry point;
- the Expo config plugin;
- generator-only dependencies such as Sharp, Expo config packages, Commander,
  and Prettier.

The package has no executable `bin`, install lifecycle scripts, telemetry, or
runtime network access. Its only JavaScript runtime dependency is
`react-native-is-edge-to-edge`.

When updating from upstream, copy runtime changes selectively. Do not add
`src/extras`, generated `dist/**/extras`, `cli.js`, `app.plugin.js`, or
generator-only dependencies. Review the packed file list and package lifecycle
scripts before accepting an update.
