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

This is not an outer Simple / Pro RootPager. The Perps entry still selects
Simple or Pro by `viewMode`; lower-tab swipes do not switch those sub-screens.

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
