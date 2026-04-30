# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **React Native cryptocurrency wallet mobile app** (Rabby Mobile) organized as a **Yarn 4 monorepo**. It supports iOS/Android with multiple hardware wallet integrations.

- **Repository**: https://github.com/RabbyHub/rabby-mobile
- **Package Manager**: Yarn 4.12.0 (via Corepack)
- **React Native**: 0.81.6
- **TypeScript**: 5.7.3

## Local Playbooks

- For `apps/mobile` Google Play upload or Android store-release preflight work, read `apps/mobile/skills/google-play-release.md` and keep the public workflow centered on `./scripts/google-play.sh upload-internal-track`; keep private inspection/report helpers under `.codex`.
- For `apps/mobile` debug export or local file sharing flows, read `apps/mobile/skills/file-share.md` and prefer `src/utils/shareLocalFile.ts` over screen-local platform branching.
- For `apps/mobile` debug, probe, or migration-diagnostics screens, read `apps/mobile/skills/debug-pages.md` and keep the page focused on live state while moving instructions into help sheets and bulk actions into an actions sheet.
- For `apps/mobile` keychain patching or upgrade work, read `apps/mobile/skills/keychain-upgrade.md` before changing Android fallback behavior, authentication policy, or package wiring.
- For `apps/mobile` code changes, read `apps/mobile/skills/import-cycles.md` and keep import-cycle detection, TypeScript typecheck, and Jest as the required self-validation set before handoff.
- For `apps/mobile` store, hooks, or Home-path performance work, read `apps/mobile/skills/perf-hooks.md` before changing selector boundaries or exposing large store state to React consumers. It captures the local rules around scene-picked minimal state, scene-level derived data, and limiting render fan-out.

## Common Commands

### Root Monorepo Commands

```bash
# Build all packages
yarn build

# Lint (ESLint + Prettier + Yarn constraints)
yarn lint

# Fix linting issues
yarn lint:fix

# Run all tests across packages
yarn test
yarn test:verbose    # Verbose output

# Run single package test
yarn workspace @rabby-wallet/<package-name> test

# Update README package list and dependency graph
yarn update-readme-content
```

### Mobile App Commands (`apps/mobile/`)

```bash
# Start Metro bundler (includes dependency build)
yarn start
yarn start:thrifty   # Lower memory usage (8GB instead of 16GB)
yarn restart         # Start with cache reset

# Run on devices
yarn ios
yarn android

# TypeScript type checking
yarn typecheck

# Import-cycle detection
yarn lint:cycles

# Jest tests
yarn test --runInBand

# Build web worker
yarn buildworker
yarn buildworker:prod:ios
yarn buildworker:prod:android

# Bundle analysis
yarn vbundle:ios
yarn vbundle:android

# Lint staged files (used by git hooks)
yarn lint:commit:fix

# Link native assets
yarn link-assets
```

## Architecture

### Monorepo Structure

```
├── apps/
│   ├── mobile/              # Main React Native app
│   ├── mobile-local-pages/  # Local pages for WebView
│   ├── dev-console-cra/     # Dev console (CRA)
│   └── go.rabby.io/         # Go service
├── packages/                # Shared packages
│   ├── base-utils/          # Base utilities
│   ├── biz-utils/           # Business utilities
│   ├── eth-keyring-*/       # 6 keyring implementations (watch, ledger, keystone, gnosis, onekey, trezor)
│   ├── keyring-utils/       # Keyring utilities
│   ├── persist-store/       # Persistence layer
│   ├── service-address/     # Address management service
│   ├── service-keyring/     # Keyring service
│   ├── service-dapp/        # DApp service
│   ├── providers/           # Web3 providers
│   └── rn-webview-bridge/   # React Native WebView bridge
```

### Mobile App Architecture (`apps/mobile/src/`)

**State Management**:
- **Zustand** for global state: `src/store/{appchain,balance,tokens,protocols}.ts`
- **Jotai**: Deprecated. Please use **Zustand**

**Navigation**:
- **React Navigation v7** with Native Stack
- Custom navigator in `src/utils/CustomNativeStackNavigator.ts`
- 9 nested navigators defined in `src/screens/Navigators/`
- Navigation types in `src/navigation-type.ts`

**Styling**:
- **NativeWind** (Tailwind CSS for React Native)
- **RNEUI** (React Native Elements UI) with custom theme
- Theme hooks: Prefer `useTheme2024()`

**Core Services Pattern**:
- Services in `src/core/services/` (39+ modules)
- Controllers in `src/core/controllers/` (RPC flow, provider, gnosis)
- APIs in `src/core/apis/`
- Storage abstraction with `persist-store` package

**Keyring & Security**:
- 6 keyring types: Watch, Ledger, Keystone, Gnosis, OneKey, Trezor
- Hardware wallet transports via BLE
- Biometric authentication: `react-native-keychain` + `src/hooks/biometrics.ts`
- Security engine: `@rabby-wallet/rabby-security-engine`

**Database & Storage**:
- **TypeORM** with SQLite via `@op-engineering/op-sqlite`
- **MMKV** for fast key-value storage
- Cloud storage backup support

**Web3 Integration**:
- **Ethers.js** v5.4.2 for primary Ethereum interactions
- **Viem** v2.17.4 for modern Ethereum operations
- **WalletConnect** v2.17.2
- Custom WebView bridge for dApp browser

**Performance Patterns**:
- **Reanimated 3** for animations (use `useSharedValue`, not `useState` for animation state)
- **FlashList** from Shopify for long lists
- Lazy loading with **Suspense** for heavy components
- Utilize React 19 **transitions** for non-urgent state updates.

### Testing Setup

- **Jest** with `ts-jest` preset for packages
- **Jest** with `react-native` preset for mobile app
- Each package has its own `jest.config.js`
- Shared test setup in `/tests/setup.ts` and `/tests/setupAfterEnv/`
- Run single test: `yarn workspace @rabby-wallet/<package> test --testNamePattern="pattern"`

## Important Conventions

### TypeScript
- Prefer `type` over `interface` for type definitions
- Avoid `any` types when possible
- Use project references for build optimization

### React Native
- Use `StyleSheet.create()` over inline styles for performance
- Use `FlatList`/`FlashList` for long lists with stable `key` props (not array indices)
- Clean up subscriptions/timers in `useEffect` cleanup

### Reanimated
- Use `useSharedValue` (not `useState`) for animation state
- Add `'worklet';` directive in worklet functions
- Use `runOnJS()` for JS calls from UI thread
- Read `.value` only in worklets

### Zustand
- Use selectors to subscribe to specific slices
- Use `shallow` for multiple values
- Keep stores small and focused
- Never mutate state directly

### Typography (Text Components)
- **Always import Text, TextInput from `@/components/Typography`** (not from `react-native` directly)
- This wrapper ensures consistent `allowFontScaling: false` behavior across the app
- Available exports: `Text`, `TextInput`, `RNGHText`, `RNGHTextInput`, `AnimateableText`, `RNEUIText`
- ESLint rule `no-restricted-imports` enforces this pattern

### Git Workflow
- Pre-push hook runs `yarn lint`
- Lint-staged runs on commit for staged files
- Main branch is `develop`
- For `apps/mobile` code changes, run `yarn workspace rabby-mobile lint:cycles`, `yarn workspace rabby-mobile typecheck`, and `yarn workspace rabby-mobile test --runInBand` before handoff. If one is intentionally skipped, state the reason.

## File Organization

- Screens: `src/screens/` (lazy and eager imports)
- Components: `src/components/` (legacy), `src/components2024/` (new theme)
- Hooks: `src/hooks/` (custom hooks)
- Utils: `src/utils/` (general utilities)
- Core: `src/core/` (services, APIs, controllers, bridges)
- Store: `src/store/` (Zustand stores)
- Constants: `src/constant/`
- Assets: `src/assets/`

## Environment & Configuration

- Environment variables via `react-native-dotenv`
- Config files: `tailwind.config.js`, `metro.config.js`, `babel.config.js`
- Platform-specific code: Use `IS_ANDROID`, `IS_IOS` from `src/core/native/utils`
