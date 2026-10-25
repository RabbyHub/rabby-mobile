# Perps Pro Layout and Linked Pager Design

Perps Pro uses one native vertical scroll owner and retained horizontal pages
with at most two tab levels. Its horizontal presentation is a real parent and
child view hierarchy; a single UI-thread gesture controller chooses which level
to move. This preserves vertical continuity while supporting live horizontal
previews without independently moving containers having to chase each other.

The current Perps default `flat` interaction was accepted on Android and iOS
devices in October 2026. The
[package README](../../../../packages/rn-collapsible-scene-view/README.md)
owns the reusable API contract. This document owns the Perps-specific layout,
business state, integration constraints, and regression scenarios. Update them
together when those contracts change.

## Scope and layout

The horizontal parent tabs here are Positions, Orders, and Account. Orders has
Basic and Conditional children when the business collection exposes categories.
The internal Orders key is `openOrders`.

```text
PerpsProScene
├─ SceneList: only native vertical scroll owner
│  ├─ ListHeaderComponent
│  │  ├─ Lead-in placeholder for header, region alert, and market
│  │  ├─ Trade panel in normal layout flow
│  │  └─ Main Tabs placeholder
│  └─ One real list cell containing LinkedScenePager
│     └─ Parent track: Positions | Orders | Account
│        └─ Orders parent page
│           ├─ Shared controls and Basic / Conditional pills
│           └─ Child track: Basic | Conditional
└─ Sibling overlays: header, region alert, market, and main Tabs
```

The main Tabs strip stays outside the horizontal track. The top chrome and
trade panel do not move sideways when switching information tabs. Orders
controls, including the shared area between the main Tabs and child rows,
belong to the Orders parent page, not to an independent floating follower.

This lower pager is independent from the outer Simple / Pro `RootScenePager`.
Lower-tab swipes never switch those sub-screens, including at an inner boundary.

## Simple / Pro root presentation

The Perps route waits for the persisted `viewMode` to hydrate before mounting
the root pager. Simple and Pro retain separate keyed screen trees and their own
native vertical scroll owners; the Pro subtree above still has exactly one
vertical owner. An idle prewarm mounts the neighboring tree without authorizing
its business effects. Switching modes translates retained content screens rather
than unmounting one screen and constructing the other. The common header is a
single Root-owned overlay outside the horizontal track, still inside the same
gesture detector. Back, mode, and account controls never move horizontally or
duplicate in a preview. Simple retains an inert header-height placeholder; Pro
retains its existing header/market/Tabs geometry and native vertical owner.

The Root supplies Pro's stable `nativeScrollY` to both its list/pinned layers and
the shared header. The header's native graph multiplies the clamped Pro collapse
by a mode weight: zero for Simple's fixed header and one for Pro's collapsing
header. After a completed mode switch, a 180ms native-driver animation changes
that weight; cancelled previews keep the source state. This is a post-settlement
vertical handoff, not finger-linked header interpolation. It adds no per-frame
JS scroll listener and leaves the Pro native vertical clock intact. A fixed
safe-top clip prevents the collapsing header from entering the status bar;
the overlay does not reserve another row or change page scroll offsets.
The shared header is transparent in both modes; its decorative SVG stays with
the fixed controls. Simple's fixed placeholder exposes its own page background.
An opaque Pro-colored wash sits inside the Pro Root page, above its pinned
market, and follows the header's exact native vertical translation without the
controls' fade. Its horizontal movement is inherited from the real page track,
so the background color boundary matches the content throughout a drag instead
of changing the whole header's color on settlement. This prevents an already-
collapsed Pro preview from showing market text through the Simple header, while
leaving the pinned market uncovered once the header is fully collapsed. No
second horizontal follower, per-frame React update, or extra scroll owner is
introduced.

Keep three concerns separate:

- Visibility includes the selected screen and a transition preview, but does
  not activate Root display subscriptions. A preview retains its last display
  snapshot; the source stays selected while dragging. Only the selected screen
  on the focused route publishes activity-aware display updates, and the
  destination catches up from the latest snapshot once selected on settlement.
  A cancelled preview never resumes the neighbor's display subscriptions.
  This boundary does not depend on touch gating or preference-save status,
  stop the shared business Store, or automatically pause ordinary subscriptions.
  The lower linked Tabs keep their separate preview-active policy, constrained
  by this enclosing Root activity.
- Business activity belongs only to the selected mode on the focused route.
  A saved mode is a return-visit preference, not trading authorization. Account,
  runtime and transaction validation stay inside the active scene. Hidden
  previews cannot own invitation flows, popups,
  keyboard-scroll ports, or transaction preparation. The native iOS keyboard
  accessory host stays mounted with its retained inputs even while inactive.
- Interaction belongs only to the settled screen. A preview cannot receive
  business touches, but a pending preference save never disables navigation or
  the settled screen. Focus, keyboard, popup and modal exclusions still apply.

Root motion and mode-label highlighting share the pager's exact fractional
`position` on the UI runtime. The overlay receives a stable `RootScenePagerUI`
handle: `position`, UI-settled `selectedIndex`, and the `select(index)` worklet.
Root Tab taps invoke this same transport directly, including during a snap or
before JS has published the previous settlement. The labels blend two fixed
theme typography styles by opacity; neither font layout nor React selection
drives the animation. Accessibility selection follows the UI-settled index;
accessibility activation schedules the same worklet from its JS callback.

React's selected mode remains the business/activity projection, not a second
visual owner. Delayed settlement echoes must not replay an old visual request.
Root Tab navigation uses the focus/modal/keyboard gate separately from business
touch gating: a pending React settlement cannot disable reverse navigation.
Account/back controls retain the business gate. This isolates presentation from
JS backlog, not from UI-thread contention, Fabric mounting, or GPU overload.

Buttons request a visual destination. A settled switch saves the existing
mode preference; a cancelled preview does not. `usePerpsRootModeAdapter` accepts
visual requests immediately and serializes the latest settled preference around
the existing controller's single flight. Persistence has no React-published
busy state. Older results never restore an earlier visual choice, and failure
leaves the selected screen usable without an automatic retry loop. A later
explicit choice can retry. The accepted settled queue may drain after route
unmount, without publishing UI state or retaining a permanent subscription.
A newer preference consumer supersedes that retired route's queued work; an
old route must never overwrite the choice made after re-entry.

Selection/settlement callbacks only perform cheap popup cleanup and intent
bookkeeping. Root UI taps do not enqueue JS press-in prewarming or a duplicate
JS navigation command: either could arrive after a newer UI choice. Idle
retained-tree mounting remains. Both taps and cold swipes use Pro's own active
scene initialization, which still validates account identity, current market,
runtime readiness and stale asynchronous results. Non-Root button consumers
retain their existing optional press-in prewarming.

Closed auxiliary UI must not be rebuilt merely because Root selection changes.
The Kline host mounts on the first active Pro visit with a market, then remains
mounted across mode switches. Its visibility, live feed, preload, publication,
and sheet-navigation registration are all gated by scene activity; the existing
open intent and market-key chart reset semantics remain unchanged. Root activity
also pauses the chart's skeleton pulse while Pro is inactive. Route unmount
still releases the host.

The market selector has a lightweight imperative host. Its first open mounts
the real selector and presents it after its ref has committed. Normal dismissal
keeps that instance for fast reopening within the same active visit; leaving
Pro releases it, including its raw market subscriptions. This is not a freeze
of the whole screen or a pause of business data/validation.

`PerpsFundingHistoryOwner` is a single route-level owner. Retaining two screen
trees must not duplicate its event subscriptions or reconciliation. Identity,
approval, and asynchronously consumed risk/price inputs remain live; only proven
display subscriptions opt into inactivity gating. Never freeze transaction
validation inputs merely because they are also rendered on screen.

The root gesture is excluded over the Pro lower pager's real cell, its pinned
Tabs, and trade input/slider/TP-SL controls. The outer vertical list and its whole
header are not excluded. Exclusions use the existing reusable
`RootScenePagerGestureBlock`, not Perps-specific coordinate logic. Route blur,
background, keyboard, registered blocking modals, and Perps popup/sheet owners
disable root swipes. Root navigation and lower-tab navigation have independent
selection memory; neither changes the other's tab selection.

## Vertical ownership and overlay presentation

`LinkedScenePagerList` renders one `SceneList` whose data is a single pager
cell. Each retained leaf can contain its own `FlatList` / `VirtualizedList`.
These same-orientation nested lists inherit the real outer list-cell context:
their host is a non-scrolling view, while the outer list owns native vertical
scrolling and distributes scroll metrics. There is one native vertical scroll
source, not one VirtualizedList instance.

Keep the pager inside a real list cell. Moving it into an unrelated overlay or
wrapping leaves in another vertical ScrollView changes that ownership model.
Do not freeze or suspend the entire nested VirtualizedList: it must continue
receiving layout and scroll metrics even while its display inputs are retained.

The trade panel is part of `ListHeaderComponent` in normal layout flow. Its
wrapper must not be absolute-positioned: that removes its contribution to
header height and allows rows to overlap it. Header and main Tabs placeholders
reserve the space occupied by their sibling overlays.

`SceneList` attaches the outer host's native scroll event to `nativeScrollY`,
a React Native `Animated.Value`. The header and pinned layers consume that
value through NativeAnimated transforms. Reanimated's shared scroll offset
remains available for gesture geometry and commands, but JS does not replay
scroll offsets into overlay styles on every frame. Interactive native-clock
layers need native hit testing, as used by the Tabs controls, rather than
assuming Fabric's JS measurements always match the current native transform.

Pinned layers clamp at their configured resting positions. Consequently,
native overscroll can move the trade and row content while the main Tabs strip
stays at its clamped overlay position. It is not another vertical list failing
to keep up.

Perps disables `syncOffsetOnActivate`: a normal tab switch must not align
several independent vertical lists. Keyboard visibility adjustments and
explicit scroll-to-top requests use the same outer list ref. The tab-indexed
scroll bridge remains a business adapter; its active target and native ref
must point to that current outer owner, not a second scrolling surface.

## Horizontal ownership

The logical model describes parent pages and optional children. The rendered
view tree keeps that hierarchy instead of laying every leaf on one global
physical strip.

- A parent transition moves the whole parent page. Orders controls and its
  child viewport inherit the same ancestor transform.
- A Basic / Conditional transition moves only the child track. Shared Orders
  controls stay still.
- One UI-thread Pan and animation owner controls the active transition. There
  are not two independent native horizontal pagers competing for that drag.

This replaces the earlier approach where Orders controls followed a separately
moving horizontal surface. Separate event delivery and corrective transforms
could produce a visible pullback even if both parts eventually reached the
same position. Sharing the actual moving ancestor removes that source of
relative displacement; it does not promise that the app can never drop frames.

Finger tracking, transition progress, tab-indicator movement, and snap animation
run on the UI thread. JS updates preview activity and captured layout at
transition boundaries, then publishes settled business selection. It does not
drive horizontal translation frame by frame. A new drag can interrupt a snap
at its current fractional position; queued tab commands retain the latest
requested selection. Stale completion callbacks must not commit an old target.

## Gesture routing and selection memory

Both routing modes use the same visual hierarchy and controller. `pagingMode`
is a mount-time choice, not a second rendering implementation.

| Mode                   | Where the drag starts                                                        | Routing                                                                           |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `flat` (Perps default) | Anywhere in the lower pager region, including shared controls or blank space | Try the adjacent child first; at the child boundary, move to the adjacent parent. |
| `nested`               | Inside measured child content                                                | Move between children; clamp at the child boundary.                               |
| `nested`               | In shared controls or outside child content                                  | Move between parent tabs.                                                         |

Vertical drags still belong to the outer native list, and controls remain
tappable. In precise `nested` mode, a short list intentionally has a smaller
child-gesture region. `flat` makes the same child-first interaction available
throughout the lower viewport regardless of row count.

Flat routing is not a fixed global sequence that always enters Orders at the
edge nearest the source. Parent selection and child selection are independent:

- Basic → click Account → swipe back to Orders restores Basic.
- Conditional → click Positions → swipe back to Orders restores Conditional.
- While inside Orders, a child swipe or pill click changes its category.
- Entering an unvisited group selects its first valid child; an explicit
  `selectPath` can deliberately choose another child.

Parent entry must restore the remembered category in the first preview as well
as after settlement. Showing Conditional during the drag and correcting to
Basic afterwards is still a bug. The Perps adapter also preserves the business
category for explicit parent-tab clicks.

Main-tab highlighting uses `indicatorPosition`, not only the selected React
prop. Keep `snapPerpsProTabIndicator` synchronization for settled or externally
changed selection, so highlight, displayed rows, and business preference agree.

## Business data and retained activity

Page existence is distinct from row count. When the Orders category UI exists,
both Basic and Conditional remain pages even if one has zero rows or a symbol
filter hides its rows. When both category presentations report authoritative
emptiness of the whole collection, the Perps adapter uses a plain Orders page
without the child-category UI. It never removes the Orders parent tab merely
because the count is zero.

Pages retain their component state and virtualized content for previews.
`RetainedRows` holds the last display data and row renderer while inactive,
then accepts current inputs when active. An account identity change invalidates
those inputs even while inactive; the Perps list is also keyed by account
identity to reset presentation rather than carry another account's state.

`LinkedScenePagerList` supplies `StoreActivityBoundary` around leaves and group
controls. Activity includes the current page and transition previews, subject
to the enclosing screen's activity. Interaction belongs to the settled page,
not to an in-flight preview. Activity-aware subscriptions disconnect while
inactive and read the latest snapshot on reactivation. Ordinary subscriptions
do not gain that behavior automatically, and background business services are
not stopped by this UI boundary. See the existing
[performance playbook](../../skills/perf-hooks.md) when changing subscriptions.

Stable keys preserve page identity. A page-topology or established viewport-width
change resets the horizontal owner to a valid committed path; it does not
replay old pixel positions at a new width or replace the outer vertical list.
Normal tab changes are not topology changes.

## Implementation map

| File                                                                                                                                                                                                          | Responsibility                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [PerpsProScene.tsx](../screens/PerpsPro/scene/PerpsProScene.tsx)                                                                                                                                              | Header composition, pinned overlays, indicators, scroll bridge, and business selection.                                                 |
| [PerpsProInfoSingleList.tsx](../screens/PerpsPro/components/info/PerpsProInfoSingleList.tsx)                                                                                                                  | Perps page topology, category preservation, row selection, and shared Orders controls.                                                  |
| [LinkedScenePagerList.tsx](../components/RetainedScenePagerList/LinkedScenePagerList.tsx)                                                                                                                     | The outer SceneList, real pager cell, shared ref, and activity adapters.                                                                |
| [RetainedRows](../components/RetainedScenePagerList/RetainedScenePagerBody.tsx)                                                                                                                               | Retained leaf display inputs and nested virtualized rows. The legacy native pager in the same file is not this path's horizontal owner. |
| [LinkedScenePager.tsx](../../../../packages/rn-collapsible-scene-view/src/LinkedScenePager.tsx)                                                                                                               | UI-thread transport, nested view tree, preview activity, and settlement.                                                                |
| [linkedSceneModel.ts](../../../../packages/rn-collapsible-scene-view/src/linkedSceneModel.ts) and [linkedPresentationModel.ts](../../../../packages/rn-collapsible-scene-view/src/linkedPresentationModel.ts) | Logical paths, routing, selection memory, and parent/child presentation geometry.                                                       |
| [SceneList.tsx](../../../../packages/rn-collapsible-scene-view/src/SceneList.tsx) and [layers.tsx](../../../../packages/rn-collapsible-scene-view/src/layers.tsx)                                             | Native vertical host, event attachment, and overlay transforms.                                                                         |

## Regression expectations

Preserve these cases when changing layout, routing, or activity boundaries:

- Drag vertically from trade, Orders controls, actual rows, and the blank area
  beneath a short list. The whole scrollable scene moves without relative gaps;
  Tabs and market retain their specified pinning and tappable positions.
- Swipe between every parent pair in both directions, slowly and quickly.
  Orders controls and rows move together during parent transitions; only rows
  move during child transitions. Test at the top and with Tabs pinned.
- Exercise both routing modes with zero, one, and many rows. Check Basic and
  Conditional separately, filtered-empty categories, and whole-collection empty
  Orders. Zero-count visible pages remain reachable.
- Leave each Orders category using a parent-tab click and return from either
  side. Verify category memory during the first preview and after settlement.
- Interrupt an animation, reverse direction, cancel a drag, and issue rapid tab
  clicks. Selection, content, and indicator converge without a stale callback
  restoring an earlier destination.
- Update data while a page is inactive, then preview and enter it. Check fresh
  content, retained list measurement, and no unintended background render work.
  Switch accounts and change width without displaying stale account rows.
- Exercise keyboard scrolling and explicit scroll-to-top after switching tabs;
  both must address the one native vertical owner.
- Switch Simple / Pro by buttons and by complete or cancelled swipes. Check
  retained scroll/draft state, saved initial mode, immediate reverse navigation
  during a pending save, latest-settled persistence and no rollback on failure.
  Delay JS publication and verify that the track, label highlight and native
  Tab taps still follow the UI owner, then converge to the latest business
  selection after JS catches up. A mocked delayed queue proves ordering only;
  a bounded real-device JS-stall probe supplies separate runtime evidence.
  Enter Pro without press-in to verify cold scene initialization. Check that
  hidden previews do not open popups or duplicate journal work. Verify inner
  Tabs/Pills and trade sliders never move the Root track. Repeat on iOS and
  Android; mocked gesture tests cannot establish native gesture arbitration.

Pure model coverage lives beside the package models. Component coverage includes
[DevUILinkedSubScreen.test.tsx](../screens/Testkits/DevUILinkedSubScreen.test.tsx),
[DevUIRetainedTabs.test.tsx](../screens/Testkits/DevUIRetainedTabs.test.tsx),
[PerpsProScene.test.tsx](../screens/PerpsPro/scene/PerpsProScene.test.tsx), and
[SceneLayers.nativeScroll.test.tsx](../screens/PerpsPro/components/info/SceneLayers.nativeScroll.test.tsx).
These checks protect routing and integration contracts; mocked gesture or
animation execution does not prove native arbitration, frame timing, or feel.
Recheck those on Android and iOS devices after gesture or layout changes. Keep
performance measurements tied to the tested device and build configuration,
separate from subjective smoothness acceptance.
