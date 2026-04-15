# maestro automation

Deterministic and hierarchy-driven automation for Rabby Mobile.

This is the preferred local e2e path right now.

Current first flow:

- `flows/android-onboarding-import-private-key.yaml`
  - start from the welcome page
  - import via private key
  - set app password
  - explicitly turn biometrics off when the toggle is on
  - wait for single-address balance to render after success, then return to unlocked Home

- `flows/android-onboarding-import-private-key-to-single-home.yaml`
  - same onboarding path, but it intentionally stops on single-address Home
  - this is the base flow for single-address balance smoke validation

- `flows/android-home-balance-smoke.yaml`
  - preserve app data and relaunch
  - bootstrap from Welcome, Unlock, or Home
  - wait until Home portfolio balance exits the loading state
  - on debug builds, validate Home state through the DevTools bridge
  - toggle the Home curve once and then restore it

- `src/run-android-single-home-balance-smoke.mjs`
  - clear app state and import the first configured private key
  - stop on single-address Home
  - on debug builds, validate balance / change / curve state through the DevTools bridge
  - toggle the single-address curve once and then restore it
  - return to unlocked Home at the end of the debug validation chain

- `src/run-android-balance-suite.mjs`
  - runs the current balance-focused debug regression chain in order
  - onboarding into single-address Home
  - relaunch and verify Home portfolio balance
  - add watch address and verify Home recovers afterward

- `src/run-android-components2024-showcase-smoke.mjs`
  - preserve app data and relaunch
  - bootstrap from Welcome, Unlock, or Home
  - navigate from Home into Settings -> UI Playground -> 2024 Components
  - verify a small set of stable `components2024` interactions through testIDs

Run:

```bash
cd apps/automation-maestro
cp .env.example .env.local
# fill RABBY_ANDROID_TEST_PRIVATE_KEYS in .env.local
node src/run-android-onboarding-import-private-key.mjs
```

Or from the repo root:

```bash
yarn workspace automation-maestro run:android-onboarding-import-private-key
```

Home balance smoke:

```bash
yarn workspace automation-maestro run:android-home-balance-smoke
```

Single-address balance smoke:

```bash
yarn workspace automation-maestro run:android-single-home-balance-smoke
```

Balance suite:

```bash
yarn workspace automation-maestro run:android-balance-suite
```

Components2024 showcase smoke:

```bash
yarn workspace automation-maestro run:android-components2024-showcase-smoke
```

Multi-key run:

- first key uses the onboarding flow above
- remaining keys reuse unlocked Home and import from the top-right add-address entry
- no extra app reset/relaunch between the remaining keys

```bash
yarn workspace automation-maestro run:android-onboarding-import-private-keys
```

## Runtime

- requires `node >= 22`
- the shell entrypoints are intentionally thin and delegate to the Node runners
- `RABBY_ANDROID_TEST_PRIVATE_KEYS` is a `;`-separated list
- Maestro itself does not auto-read `.env*` here
- the Node runner loads local env files, resolves config, then passes values to
  `maestro test -e ...`
- debug-package runners additionally connect to Metro DevTools and write bridge snapshots as JSON artifacts next to the Maestro HTML reports
- local-only files such as `.env.local`, `.env.regression`, and `.artifacts/`
  are expected to stay untracked inside this package

Example:

```bash
RABBY_ANDROID_TEST_PRIVATE_KEYS=0xabc...;0xdef...;0x123...
```

Compatibility:

- the single-key legacy env `RABBY_ANDROID_TEST_PRIVATE_KEY` still works
- the existing single-flow runner defaults to the first key in
  `RABBY_ANDROID_TEST_PRIVATE_KEYS`

Env loading order:

1. inherited shell environment
2. `./.env`
3. `./.env.local`

Later files override earlier files. Inherited shell env wins over all local
files.

Profile-specific env:

- set `RABBY_MAESTRO_ENV=regression` to additionally load
  `./.env.regression` and `./.env.regression.local`
- profile files are loaded after the generic `.env*` files, so they can
  override package name, password, and test key settings cleanly

Artifacts:

- by default, reports are written to `apps/automation-maestro/.artifacts/`
- override the output root with `RABBY_MAESTRO_ARTIFACTS_DIR=...`

## Optional config file

If present, the runner auto-loads the first matching file:

- `maestro.config.local.mjs`
- `maestro.config.local.js`
- `maestro.config.local.cjs`
- `maestro.config.local.json`
- `maestro.config.mjs`
- `maestro.config.js`
- `maestro.config.cjs`
- `maestro.config.json`

You can also point to a specific file with `RABBY_MAESTRO_CONFIG=...`.

Example:

```js
export default {
  maestro: {
    binary: "/Users/you/.maestro/bin/maestro"
  },
  android: {
    onboardingImportPrivateKey: {
      packageName: "com.debank.rabbymobile.debug",
      appPassword: "11111111",
      launchActivity:
        "com.debank.rabbymobile.debug/com.debank.rabbymobile.MainActivity"
    },
    homeImportPrivateKey: {
      flowFile: "flows/android-home-import-private-key.yaml"
    }
  }
};
```
