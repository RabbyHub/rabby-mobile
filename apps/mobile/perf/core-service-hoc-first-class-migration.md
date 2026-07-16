# Core Service HOC First-Class Migration

This document records the complete audit of React consumers that wait for
registered core services. The first migration class is defined as follows:

- The component cannot provide its real feature before all required services
  are ready.
- Rendering the component behind one typed boundary is behaviorally equivalent
  to checking readiness inside the component.
- The component does not intentionally expose a partial-data fallback while a
  deferred service is loading.

The semantic baseline is the latest `origin/develop`, not an intermediate form
of the service-registration experiment. In particular, the migration preserves
the synchronous session mutation order and creates a BackgroundBridge for the
built-in `about:blank` and `about:rabby` pages just as `develop` does.

## Migrated dependency contract

Two current production components belong to this class. `DappWebViewCore`
cannot safely create or use a bridge before both `dappService` and
`sessionService` are available. `AccountSwitcherModalInDappWebView` is mounted
inside the DApp screen and requires `dappService` before its account-switch
action can preserve the synchronous mutation order from `develop`.

- `apps/mobile/src/core/bridges/backgroundBridgeServices.ts`
  - Owns the dependency declaration.
  - Exports the resolved service type and injected-prop type.
  - Exports the feature-specific `withBackgroundBridgeServices` HOC so callers
    do not repeat dependency lists or service casts.
- `apps/mobile/src/core/bridges/useBackgroundBridge.ts`
  - Supports ready, typed synchronous injection for the first-class component.
  - Retains local readiness for components whose outer UI deliberately renders
    before the WebView.
- `apps/mobile/src/components/AccountSwitcher/dappAccountSwitcherServices.ts`
  - Owns the DApp account-switch dependency and its typed feature HOC.
  - Keeps the injected service private to the wrapped implementation.
- `apps/mobile/src/core/serviceApi/serviceDependencies.tsx`
  - Allows an HOC fallback to be derived from external props, preserving the
    wrapped component's layout while services load.

## Migrated components

`DappWebViewCore` already returned one root-level placeholder until bridge
services were ready. `AccountSwitcherModalInDappWebView` is only mounted from
the DApp screen, whose open path already requires `dappService`; injecting it at
that boundary restores the synchronous account mutation from `develop` without
moving service activation into application startup. Both receive a typed
`coreServices` prop internally while their public props omit the injected prop.

1. `apps/mobile/src/components/WebView/DappWebViewCore.tsx`
2. `apps/mobile/src/components/AccountSwitcher/Modal.tsx`

The WebView fallback preserves the caller-provided layout style and existing
disabled behavior. The account switcher receives a synchronous, typed
`dappService` instance before rendering, so its mutation again completes before
the scene switch starts.

## Audited and intentionally retained

These consumers are not first-class HOC candidates. Moving their readiness
checks to an outer boundary would change existing intermediate UI behavior or
eagerly activate a service for an event that may never occur.

### BackgroundBridge partial UI

The components below deliberately render their header or outer browser UI while
only the WebView waits for bridge services. They retain the local readiness
check because wrapping the whole component would change the first visible state
from `develop`.

1. `apps/mobile/src/components/WebView/DappWebViewControl.tsx`
2. `apps/mobile/src/components/WebView/DappWebViewControl2/DappWebViewControl2.tsx`
3. `apps/mobile/src/screens/Browser/BrowserScreen/components/BrowserTab/index.tsx`

### Transaction history partial-data fallback

`apps/mobile/src/core/serviceApi/transactionHistoryHooks.ts` intentionally lets
the surrounding screen render with an empty or zero history result, then
resamples after `transactionHistoryService` becomes ready. Its consumers are:

1. `apps/mobile/src/screens/Bridge/hooks/history.tsx`
2. `apps/mobile/src/screens/Send/hooks/useRecentSend.ts`
3. `apps/mobile/src/screens/TokenDetail/components/HistoryList.tsx`
4. `apps/mobile/src/screens/Swap/hooks/history.ts`
5. `apps/mobile/src/screens/Transaction/MultiAddressHistory.tsx`
6. `apps/mobile/src/screens/Lending/components/Header.tsx`
7. `apps/mobile/src/screens/Lending/components/LendingHistory.tsx`

`useRecentSend.ts` has two readiness consumers; both share the same intentional
partial-data behavior.

### Dapp account fallback and event actions

`apps/mobile/src/hooks/useDapps.ts` retains the account resolver pattern:

- `useDappAccountResolver` resolves from accounts immediately, falls back to an
  empty transaction list while history loads, and converges when the deferred
  service becomes ready.

Indirect consumers of the resolver include:

1. `apps/mobile/src/components2024/DappFrameAccountHeader/useDappListWithValue.ts`
2. `apps/mobile/src/components2024/InnerDappWebViewScreen.tsx`
3. `apps/mobile/src/hooks/useInnerDappValue.ts`
4. `apps/mobile/src/screens/Browser/BrowserScreen/components/BrowserTab/index.tsx`

The following event paths also intentionally use `runWithCoreServices`; an HOC
would load services while rendering instead of when the user invokes the
action:

1. `apps/mobile/src/screens/Dapps/hooks/useDappView.ts`
2. `apps/mobile/src/screens/Dapps/hooks/useDappWebViewScreen.ts`

## Validation

- Mobile TypeScript typecheck
- ESLint on every changed source file
- Core service API boundary lint
- Core service dependency unit tests
- Dependency-cycle scanner
- ESLint cycle scanner
- Android regression build with Metro transform cache enabled; 16 KB page-size
  validation passed. The same APK was installed and launched on Huawei ALN-AL80
  and BNE-AL00 devices. Both reached Home, opened the real Lending
  `DappWebViewCore` path, and rendered the Plasma market, active account, and
  balance without bridge or uninitialized-service errors. The browser's local
  readiness path also opened `example.com` on both devices.
- iOS ad-hoc regression build with Metro transform cache enabled; installed and
  launched on the connected iPhone 13 mini without an immediate crash.
