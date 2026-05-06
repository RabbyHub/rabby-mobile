---
name: mobile-keychain-upgrade
description: When patching, forking, or upgrading `react-native-keychain` in `apps/mobile`, review the historical 8.2.0 Android business patch, preserve only the behavior that Rabby still depends on, and revalidate the repo-specific keychain integration points before changing package wiring.
---

# Mobile Keychain Upgrade

Use this note when working on any of these:

- upgrading `react-native-keychain`
- refreshing a Yarn patch for `react-native-keychain`
- rebuilding the local fork under `packages/react-native-keychain`
- debugging Android biometric keychain migration behavior

## Historical Patch Source

The older `8.2.0` Yarn patch was deleted from the worktree, but it is still available in git history.

Use this command to inspect it:

```bash
git show HEAD:.yarn/patches/react-native-keychain-npm-8.2.0-ff8c16b501.patch
```

Do not rely on memory. Re-read the patch before assuming which behavior came from upstream and which came from Rabby.

## Business-Impacting Changes From The Old 8.2.0 Patch

These are the changes that affected real Android behavior and should be consciously re-evaluated during later upgrades.

### 1. Conceal Was Removed From The Android Path

The patch:

- commented out `com.facebook.conceal:conceal` in `android/build.gradle`
- stopped registering `CipherStorageFacebookConceal`
- deleted `CipherStorageFacebookConceal.java`

Implication:

- Rabby intentionally stopped depending on Facebook Conceal on Android.
- Any future patch or fork should not silently reintroduce Conceal as the default legacy fallback.

### 2. Missing Cipher Marker Defaults Were Changed From Conceal To RSA

The patch changed `PrefsStorage` so that when the stored cipher marker is missing, the entry resolves to `KnownCiphers.RSA` instead of `KnownCiphers.FB`.

Implication:

- This is migration-critical for older Android entries that were stored without the marker.
- If a later upstream version changes fallback behavior, verify that Rabby can still interpret marker-missing legacy RSA entries.

### 3. Android User Authentication Handling Was Customized

The patch changed `KeychainModule.java` to:

- catch `"User not authenticated"` cases
- hold pending read/write state
- launch `KeyguardManager.createConfirmDeviceCredentialIntent(...)`
- resume the original `get` or `set` flow from `onActivityResult`
- support prompt title/description keys

Implication:

- This was not cosmetic. It changed how Android re-prompts for device credentials during keychain operations.
- If upstream changes authentication handling, compare behavior carefully instead of assuming equivalent UX.

### 4. Android Key Generation/Auth Policy Was Modified

The patch changed both AES and RSA cipher storage code paths so that auth-related key generation parameters were no longer left entirely at upstream defaults.

Observed changes included:

- plumbed `accessControl` through encryption calls
- made auth requirements conditional instead of always-on in RSA key generation
- changed RSA auth validity duration from `5` seconds to `1`
- changed AES key-generation behavior in auth-related settings as well

Implication:

- These are behavior changes, not refactors.
- Do not blindly copy them into a newer upstream version; verify whether upstream already fixed the original problem or whether Rabby still needs a subset of these changes.

### 5. RSA Biometrics Read Flow Changed In Upstream 9.0.0

The older Rabby-flavored `8.2.0` RSA path always routed biometrics reads through the interactive auth handler before decrypting. During the `9.0.0` investigation, upstream was found to behave differently:

- it first attempted RSA decrypt non-interactively
- it only fell back to `askAccessPermissions(...)` when Android threw `UserNotAuthenticatedException`
- this produced visibly different UX on some devices even when the configured auth validity window looked similar

Implication:

- Do not assume that matching `keystoreUserAuthenticationValidityDurationSeconds` is enough to preserve behavior.
- During upgrades, verify both the key generation policy and the RSA decrypt control flow.
- If Rabby still requires “every biometrics read should re-prompt” semantics for the RSA path, the upstream decrypt flow may need to be patched back to the interactive-first behavior.

### 6. Android Session-Reuse Testing Should Stay Explicit

This repo now exposes an Android-only experiment option:

- JS option: `androidAuthPromptPolicy`
- Native flag passed to the library: `androidAllowAuthenticatedSessionReuse`

Expected use:

- default business behavior stays `interactive-first`
- `allow-authenticated-session-reuse` is only an explicit Android experiment/probe path
- do not silently flip the default business path to the session-reuse behavior just because upstream does it

Implication:

- when evaluating future upstream releases, test both policies on the same entry
- treat “strict always re-prompt” and “allow time-based authenticated session reuse” as two separate behaviors, not one vague auth setting

## Current Repo Integration Notes

Today this repo keeps two keychain lines available:

1. Default business path:
   [`react-native-keychain@9.x`](../src/core/apis/keychain.ts)

2. Legacy Rabby fork for fallback and migration comparison:
   [`@rabby-wallet/react-native-keychain`](../../../packages/react-native-keychain)

Business code still imports the local fork explicitly as `v8_2_0` for the
debug switch and migration tools, for example:

- [`src/core/apis/keychainV8_2_0.ts`](../src/core/apis/keychainV8_2_0.ts)
- [`src/hooks/biometrics.ts`](../src/hooks/biometrics.ts)

If you rename Android package classes in the local fork, also keep:

- [`apps/mobile/react-native.config.js`](../react-native.config.js)

in sync, because this repo already hit autolinking collisions between the local fork and the official package.

## Upgrade Checklist

When refreshing a patch or rebasing the local fork to a newer upstream version:

1. Re-read the historical `8.2.0` patch from git.
2. Classify each old change as one of:
   - still required business behavior
   - already fixed upstream
   - obsolete workaround
3. Verify Android behavior for these cases:
   - current service metadata read
   - current service official read
   - current service official read plus Rabby app-layer decrypt
   - probe write/read on the official package
   - marker-missing legacy mock entry
   - repeated prompt regression case: after clearing and recreating a biometrics entry, run the same decrypt action twice with a delay and confirm that both reads still prompt
   - explicit Android session-reuse comparison: run the same read once with `interactive-first` and once with `allow-authenticated-session-reuse`, then repeat after delays to confirm the difference is really caused by prompt policy
4. Treat changes to auth validity duration, key aliasing, or fallback cipher selection as migration-sensitive.
5. If you touch package names or ReactPackage class names, re-check autolinking output before assuming Gradle will resolve the right package.

## Reporting

When finishing a keychain upgrade or patch refresh, report:

- which upstream version you evaluated
- which historical 8.2.0 behaviors were intentionally preserved
- which historical behaviors were dropped as obsolete
- whether marker-missing legacy RSA entries were tested
- whether official read and app-layer decrypt both succeeded on Android
- whether the repeated decrypt prompt case matched the expected Rabby behavior
- whether the explicit Android session-reuse probe behaved differently from the strict interactive-first path
