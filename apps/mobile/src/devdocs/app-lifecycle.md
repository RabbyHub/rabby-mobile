# Rabby Mobile App Lifecycle

This document describes the lifecycle currently implemented by Rabby Mobile.
It separates one-shot application startup from repeatable feature activation
cycles so that startup work is not accidentally attached to screen renders.

## Application lifecycle

```mermaid
stateDiagram-v2
    [*] --> NativeLaunch
    NativeLaunch: Native process and static splash
    NativeLaunch --> AppMounted: React App mounts

    state AppMounted {
        [*] --> LaunchRegistration
        LaunchRegistration: Register service loaders and launch tasks
        LaunchRegistration --> LaunchPhase: startLaunchPhase()
        LaunchPhase: Run registration, immediate, preSplash, and homeCritical tasks
        LaunchPhase --> BootstrapGate: Load lock state and security chain
    }

    BootstrapGate --> GetStarted: no usable wallet
    BootstrapGate --> Unlock: visible accounts require authentication
    BootstrapGate --> HomeEntry: valid unlock session

    GetStarted --> Unlock: wallet created or imported
    Unlock --> HomeEntry: WALLET_AUTH_UNLOCKED and POST_UNLOCK_UI_READY

    state HomeEntry {
        [*] --> HomeEntryReady
        HomeEntryReady: home: entry-ready
        HomeEntryReady --> HomeMounted: navigation renders Home
        HomeMounted: home: mounted
        HomeMounted --> HomeReady: two frames plus critical delay
        HomeReady: home: ready
        HomeReady --> HomePostStartupReady: interactions settle plus defer window
        HomePostStartupReady: home: post-startup-ready
        HomePostStartupReady --> HomeIdle: InteractionManager and idle callback
        HomeIdle: home: idle tasks
    }

    HomeMounted --> HomeContentReady: first portfolio content settles
    HomeContentReady: home: content-ready
    HomeContentReady --> HomeMounted

    HomeEntry --> Foreground
    Foreground --> Background: AppState leaves active
    Background --> Foreground: session remains valid
    Background --> Unlock: auto-lock deadline expires
    Foreground --> Unlock: explicit wallet lock
    Unlock --> Foreground: authentication succeeds
```

`home: content-ready` is an independent data milestone. It may be observed
before or after `home: post-startup-ready`; neither event should wait for the
other. The static/animated splash is hidden by its own native and React
handoff, while startup work is scheduled by milestones rather than by keeping
the first screen hidden.

## Startup task scheduling

```mermaid
flowchart LR
    Register[registration] --> Immediate[immediate]
    Immediate --> PreSplash[preSplash]
    PreSplash --> Critical[homeCritical]

    EntrySignal[homeEntryReady signal] --> EntryTasks[homeEntryReady tasks]
    PostSignal[homePostStartupReady signal] --> PostTasks[homePostStartupReady tasks]
    ContentSignal[homeContentReady signal] --> ContentTasks[homeContentReady tasks]
    PostTasks --> IdleGate[interactions and idle opportunity]
    IdleGate --> IdleTasks[homePostStartupIdle tasks]

    Demand[feature or user demand] --> OnDemand[onDemand task handle]
```

The first four task classes execute as part of the launch phase. The milestone
classes wait for their named signal. `homePostStartupIdle` additionally waits
for interactions and an idle opportunity, while `onDemand` does not run until
its owner explicitly invokes the returned handle.

## Repeatable feature activation cycle

Startup phases advance once per process launch. A feature visit is different:
each visit creates a new cycle and a later visit must not reuse the prior
cycle's completion state.

```mermaid
stateDiagram-v2
    [*] --> Requested
    Requested --> ContextReady
    ContextReady --> StatePrepared
    StatePrepared --> NavigationDispatched
    NavigationDispatched --> Mounted
    Mounted --> Visible
    Visible --> Interactive
    Visible --> DataReady
    Interactive --> DataReady
    DataReady --> Exited
    Interactive --> Exited
    Exited --> [*]
```

The diagnostic event vocabulary is shared by Swap, Bridge, Single Address,
and Gas Account. A feature may become interactive before remote data is ready;
network waiting must not be reported as synchronous JS-thread work. Starting a
new cycle supersedes an unfinished cycle for the same feature.

## State ownership rules

- `App.tsx` starts the launch phase; it must not become a list of business
  initializers.
- `useBootstrapApp` owns the render gate and initial route inputs: lock state,
  unlock-session validity, visible accounts, stored keyrings, and security
  chain readiness.
- `AppNavigation` chooses Get Started, Unlock, or Home from the bootstrapped
  state.
- Home milestones release scheduled work. UI components may report a
  milestone, but they must not directly initialize unrelated services.
- Background and foreground transitions preserve the navigation tree unless
  the auto-lock policy requires authentication.
- Feature activation cycles describe observable progress; they do not change
  business state or make diagnostics a runtime dependency.

## Implementation references

- [`App.tsx`](../App.tsx) starts the launch phase and owns the top-level render
  tree.
- [`useBootstrap.ts`](../hooks/useBootstrap.ts) loads the bootstrap gate and
  emits unlock-related readiness.
- [`AppNavigation.tsx`](../AppNavigation.tsx) selects the initial route.
- [`phaseRegistry.ts`](../startup/phaseRegistry.ts) advances the one-shot
  launch phase.
- [`startupScheduler.ts`](../core/utils/startupScheduler.ts) implements task
  stages.
- [`homeStartupMilestones.ts`](../core/utils/homeStartupMilestones.ts) owns
  entry-ready and content-ready signals.
- [`homeStartupReady.ts`](../core/utils/homeStartupReady.ts) owns Home ready,
  post-startup-ready, and idle release timing.
- [`featureActivationDiagnostics.ts`](../core/utils/featureActivationDiagnostics.ts)
  defines repeatable feature-cycle events.
- [`autoLock.ts`](../core/apis/autoLock.ts) handles foreground/background
  auto-lock deadlines.
