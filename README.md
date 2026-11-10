# Core Monorepo

This monorepo is a collection of packages used across multiple RabbyHub clients (e.g. [`Rabby`](https://github.com/RabbyHub/Rabby/), [`rabby-mobile`](https://github.com/RabbyHub/rabby-mobile/)).

## Modules

This repository contains the following packages [^fn1]:

<!-- start package list -->

- [`@rabby-wallet/base-utils`](packages/base-utils)
- [`@rabby-wallet/biz-utils`](packages/biz-utils)
- [`@rabby-wallet/eth-keyring-gnosis`](packages/eth-keyring-gnosis)
- [`@rabby-wallet/eth-keyring-keystone`](packages/eth-keyring-keystone)
- [`@rabby-wallet/eth-keyring-ledger`](packages/eth-keyring-ledger)
- [`@rabby-wallet/eth-keyring-onekey`](packages/eth-keyring-onekey)
- [`@rabby-wallet/eth-keyring-trezor`](packages/eth-keyring-trezor)
- [`@rabby-wallet/eth-keyring-watch`](packages/eth-keyring-watch)
- [`@rabby-wallet/keyring-utils`](packages/keyring-utils)
- [`@rabby-wallet/object-multiplex`](packages/object-multiplex)
- [`@rabby-wallet/persist-store`](packages/persist-store)
- [`@rabby-wallet/post-message-stream`](packages/post-message-stream)
- [`@rabby-wallet/react-native-bootsplash`](packages/react-native-bootsplash)
- [`@rabby-wallet/react-native-fs`](packages/react-native-fs)
- [`@rabby-wallet/react-native-ios-context-menu`](packages/react-native-ios-context-menu)
- [`@rabby-wallet/react-native-keychain-9`](packages/react-native-keychain-9)
- [`@rabby-wallet/react-native-menu`](packages/react-native-menu)
- [`@rabby-wallet/rn-page-provider`](packages/rn-page-provider)
- [`@rabby-wallet/rn-webview-bridge`](packages/rn-webview-bridge)
- [`@rabby-wallet/rozenite-resource-flow-plugin`](packages/rozenite-resource-flow-plugin)
- [`@rabby-wallet/service-address`](packages/service-address)
- [`@rabby-wallet/service-keyring`](packages/service-keyring)
- [`@rabby-wallet/universal-providers`](packages/providers)
- [`@rabby-wallet/zeego`](packages/zeego)
- [`automation-maestro`](apps/automation-maestro)
- [`dev-console-cra`](apps/dev-console-cra)
- [`mobile-local-pages`](apps/mobile-local-pages)
- [`rabby-mobile`](apps/mobile)

<!-- end package list -->

Or, in graph form [^fn1]:

<!-- start dependency graph -->

```mermaid
%%{ init: { 'flowchart': { 'curve': 'bumpX' } } }%%
graph LR;
linkStyle default opacity:0.5
  automation_maestro(["automation-maestro"]);
  dev_console_cra(["dev-console-cra"]);
  rabby_mobile(["rabby-mobile"]);
  mobile_local_pages(["mobile-local-pages"]);
  base_utils(["@rabby-wallet/base-utils"]);
  biz_utils(["@rabby-wallet/biz-utils"]);
  eth_keyring_gnosis(["@rabby-wallet/eth-keyring-gnosis"]);
  eth_keyring_keystone(["@rabby-wallet/eth-keyring-keystone"]);
  eth_keyring_ledger(["@rabby-wallet/eth-keyring-ledger"]);
  eth_keyring_onekey(["@rabby-wallet/eth-keyring-onekey"]);
  eth_keyring_trezor(["@rabby-wallet/eth-keyring-trezor"]);
  eth_keyring_watch(["@rabby-wallet/eth-keyring-watch"]);
  keyring_utils(["@rabby-wallet/keyring-utils"]);
  object_multiplex(["@rabby-wallet/object-multiplex"]);
  persist_store(["@rabby-wallet/persist-store"]);
  post_message_stream(["@rabby-wallet/post-message-stream"]);
  universal_providers(["@rabby-wallet/universal-providers"]);
  react_native_bootsplash(["@rabby-wallet/react-native-bootsplash"]);
  react_native_fs(["@rabby-wallet/react-native-fs"]);
  react_native_ios_context_menu(["@rabby-wallet/react-native-ios-context-menu"]);
  react_native_keychain_9(["@rabby-wallet/react-native-keychain-9"]);
  react_native_menu(["@rabby-wallet/react-native-menu"]);
  rn_page_provider(["@rabby-wallet/rn-page-provider"]);
  rn_webview_bridge(["@rabby-wallet/rn-webview-bridge"]);
  rozenite_resource_flow_plugin(["@rabby-wallet/rozenite-resource-flow-plugin"]);
  service_address(["@rabby-wallet/service-address"]);
  service_keyring(["@rabby-wallet/service-keyring"]);
  zeego(["@rabby-wallet/zeego"]);
  dev_console_cra --> rn_webview_bridge;
  rabby_mobile --> biz_utils;
  rabby_mobile --> eth_keyring_gnosis;
  rabby_mobile --> eth_keyring_ledger;
  rabby_mobile --> eth_keyring_onekey;
  rabby_mobile --> eth_keyring_watch;
  rabby_mobile --> object_multiplex;
  rabby_mobile --> persist_store;
  rabby_mobile --> react_native_bootsplash;
  rabby_mobile --> react_native_fs;
  rabby_mobile --> react_native_ios_context_menu;
  rabby_mobile --> react_native_keychain_9;
  rabby_mobile --> react_native_menu;
  rabby_mobile --> rozenite_resource_flow_plugin;
  rabby_mobile --> service_address;
  rabby_mobile --> service_keyring;
  rabby_mobile --> zeego;
  mobile_local_pages --> base_utils;
  biz_utils --> base_utils;
  eth_keyring_gnosis --> keyring_utils;
  eth_keyring_ledger --> base_utils;
  eth_keyring_ledger --> keyring_utils;
  eth_keyring_onekey --> base_utils;
  eth_keyring_watch --> keyring_utils;
  persist_store --> base_utils;
  universal_providers --> object_multiplex;
  rn_webview_bridge --> object_multiplex;
  rn_webview_bridge --> universal_providers;
  rozenite_resource_flow_plugin --> base_utils;
  service_address --> base_utils;
  service_address --> persist_store;
  service_keyring --> base_utils;
  service_keyring --> eth_keyring_watch;
  service_keyring --> keyring_utils;
  service_keyring --> service_address;
```

<!-- end dependency graph -->

Refer to individual packages for usage instructions.

## Learn more

For instructions on performing common development-related tasks, see [contributing to the monorepo](./docs/contributing.md).

[^fn1]: The package list and dependency graph should be programmatically generated by running `yarn update-readme-content`.
