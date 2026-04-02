# Rabby Mobile Requirement Notes

Use this reference after the requirement has been reduced to concrete acceptance criteria.

## Repo Shape

- Monorepo root: `@rabby-wallet/mobile-monorepo`
- Main app workspace: `rabby-mobile`
- Main product code: `apps/mobile/src`
- Android app module: `apps/mobile/android/app`

## Search And Edit Strategy

- Use `rg` first to find code ownership and call paths.
- For screen work, inspect the screen, nearby components, hooks, and stores together before editing.
- For analytics work, trace the trigger site and the shared analytics helper before adding new calls.
- For persisted settings, trace both the UI entry point and the underlying hook or preference store.

## Requirement Translation Checklist

Before coding, extract:

1. User-visible behavior changes
2. Trigger timing and dedupe rules
3. State, refresh, or persistence changes
4. Platform-specific behavior for iOS vs Android
5. Analytics, permissions, labels, empty states, and regression surface

## Validation

Prefer the smallest command that proves the touched path:

```bash
./node_modules/.bin/eslint <touched-files>
yarn workspace rabby-mobile typecheck
yarn workspace rabby-mobile test --runInBand
```

When changing a single module or test file, narrow the command instead of running the full suite.

## Analytics Verification

Shared analytics helper:

- [apps/mobile/src/utils/analytics.ts](../../../../apps/mobile/src/utils/analytics.ts)
- `matomoRequestEvent(...)` sends to both Matomo and Firebase Analytics.
- Firebase event name is derived from `category` with spaces replaced by underscores.

Examples:

- `Settings Snapshot` -> GA4 event name `Settings_Snapshot`
- `Rabby Lending` -> GA4 event name `Rabby_Lending`
- `HomeTab` -> GA4 event name `HomeTab`

The `action`, `label`, `value`, and `transport` fields are sent as event params.

### Android DebugView

No extra compile flag is required for GA4 DebugView.

Use the package name that matches the installed variant:

- debug: `com.debank.rabbymobile.debug`
- regression: `com.debank.rabbymobile.regression`
- release/main: `com.debank.rabbymobile`

Enable Firebase Analytics debug mode:

```bash
adb shell setprop debug.firebase.analytics.app com.debank.rabbymobile.debug
adb shell setprop log.tag.FA VERBOSE
adb shell setprop log.tag.FA-SVC VERBOSE
adb logcat -v time -s FA FA-SVC
```

Disable debug mode after verification:

```bash
adb shell setprop debug.firebase.analytics.app .none.
```

In Firebase / GA4 DebugView, inspect the event name from `category`, then verify `action` and `label` params.
