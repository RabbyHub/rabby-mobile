# rn-collapsible-scene-view

A small local package for "collapsed scene" layouts: a scroll-away header,
multiple stacked pinned layers, and optional retained two-level horizontal
paging. It supports two distinct vertical integrations:

- **Basic per-tab surfaces:** each tab owns a `SceneScrollView` or `SceneList`;
  the provider tracks the active offset and can align surfaces on activation.
- **Retained single-owner integration:** one outer `SceneList` owns native
  vertical scrolling; `LinkedScenePager` and retained child lists live inside
  its real list cell. Horizontal navigation does not coordinate multiple
  vertical scrollers.

This README documents the reusable contracts. The app-specific layout,
business rules, and validation boundaries are in the
[Perps Pro linked-pager design](../../apps/mobile/src/devdocs/perps-pro-linked-pager.md).

It starts as a simplified re-implementation of
`react-native-collapsible-tab-view` (the repo patches that library for the Home
screen), and extends the available layout and paging primitives:

| capability                                                      | collapsible-tab-view | this package                             |
| --------------------------------------------------------------- | -------------------- | ---------------------------------------- |
| scroll-away header                                              | yes                  | yes                                      |
| single pinned tab bar                                           | yes                  | yes                                      |
| **several pinned layers stacked**                               | no                   | yes (`PinnedLayer`)                      |
| **content that scrolls away but stays above the pinned layers** | no                   | yes (`ScrollingLayer`)                   |
| shared scene offset on switch                                   | no                   | yes                                      |
| **virtualized list surface**                                    | yes                  | yes (`SceneList`)                        |
| horizontal paging                                               | library pager        | `LinkedScenePager` or caller-owned pager |

## Basic per-tab surfaces

The original integration uses separate vertical surfaces. The active tab's
`SceneScrollView` or `SceneList` publishes its non-negative offset to the
provider's Reanimated `scrollY` shared value on the UI thread. Worklet-based
layers derive their transforms from that value, without a per-frame React
state update.

```
<CollapsibleSceneProvider headerHeight={H} activeTab={tab}>
  <HeaderLayer />       translateY = -min(scrollY, H)        (collapses)
  <PinnedLayer baseTop={H} />   translateY = clamp(H - scrollY, 0, H)  (pins)
  <ScrollingLayer baseTop={H + marketH} />                     (scrolls away)
  <PinnedLayer baseTop={tabsTop} pinTop={marketH} />           (pins below)
  <Pager>
    <SceneList tabKey="positions" contentInsetTop={H + marketH + tradeH}>
      …rows…
    </SceneList>
  </Pager>
</CollapsibleSceneProvider>
```

`pinTop` is the resting top edge of a pinned layer. Use it to stack a layer
below another pinned layer instead of at absolute zero.

`SceneList` is the virtualized equivalent of `SceneScrollView`: both reserve
`contentInsetTop` and publish the active tab's offset to the scene on the UI
thread. A page that becomes active can be aligned to the current scene offset
(`syncOffsetOnActivate` defaults to `true`). This is offset coordination
between separate surfaces, not the retained single-owner model below.

For a caller-owned pager, create the controller above the provider and share it
with the pager:

```tsx
const controller = useCollapsibleSceneController();

<CollapsibleSceneProvider controller={controller} … />
<Pager
  onDragStart={() => controller.syncTabToSceneOffset(destinationTab)}
  onRequestPage={tab => {
    controller.syncTabToSceneOffset(tab);
    setPage(tab);
  }}
/>
```

Do not use this synchronization pattern for retained pages inside one outer
list. Set `syncOffsetOnActivate={false}` on their provider: changing the
logical page must not issue vertical alignment commands to the same native
owner.

## Native vertical clock and worklet geometry

`SceneList` optionally accepts `nativeScrollY`, an RN `Animated.Value`. Pass
the same value to `CollapsibleHeaderLayer` and `CollapsiblePinnedLayer` to use
their native-clock path. The list attaches `contentOffset.y` directly from its
native scroll host through RN `Animated.attachNativeEvent`; it does not copy
Reanimated progress or JS scroll callbacks into that value. Attachments are
detached when their host/value changes or the list unmounts.

Those layers use RN NativeAnimated interpolation for vertical transforms
(and header opacity). Their memoized native host keeps the animation graph
separate from business-content updates. Interactive content must use native
hit testing, such as RNGH Pressable, rather than rely on JS measurements of
the transformed view. The interpolation clamps at the configured collapse
and pin limits; pinned layers need not follow the list's overscroll bounce.

Reanimated still receives the same scroll host's events and publishes the
non-negative scene `scrollY` for geometry, gesture decisions, and explicit
commands. `LinkedScenePager` uses its own UI-thread horizontal progress for
parent/child transforms and the indicator; this never drives vertical
scrolling. JS remains responsible for layout measurements, business inputs,
and transition/settlement publication, not per-frame horizontal motion.

Without `nativeScrollY`, the header and pinned layers use the provider's
Reanimated value instead. `CollapsibleScrollingLayer` currently uses that
worklet path only. These are presentation mechanisms, not a synchronization
barrier: neither path guarantees zero latency or same-frame presentation
across arbitrary native and Fabric views. Validate motion and hit testing on
physical devices, and prefer a shared moving ancestor when related content
must move together.

## Retained linked pages

`LinkedScenePager` supports one shared, two-level page tree with two
mount-time gesture-routing modes:

```tsx
const pages = [
  { key: 'positions' },
  {
    key: 'orders',
    children: [{ key: 'basic' }, { key: 'conditional' }],
  },
  { key: 'account' },
] satisfies readonly LinkedScenePage[];
```

- `pagingMode="flat"` (default): the whole lower region, including blank space,
  routes a swipe to an adjacent child first, then to an adjacent parent at a
  child boundary. Entering a parent restores its remembered child (or its first
  child when unvisited), regardless of entry direction. Changing an Orders
  child does not select another main tab.
- `pagingMode="nested"`: a gesture starting inside child content selects a
  sibling child; a gesture in the group header or outside child content selects
  a parent tab. The child boundary clamps rather than handing off automatically.

Both modes use `activePath: {key, childKey?}`, `onPathChange`,
`renderLeaf(path, context)`, and optional
`renderGroupHeader(key, context)`. Both policies use the same nested view tree:
the group header and child viewport share one parent page. A single UI-thread
pan/animation owner chooses either a parent transition or a child transition.
Crossing a parent boundary moves the entire parent, including its header;
switching siblings moves only the child track. There is no floating header
following a separate native horizontal scroller. Vertical drags still belong
to the outer native list, and header buttons remain independently tappable.

Each transition captures its two paths and the children's presentation
positions. Both parent-tab clicks and parent-boundary swipes restore the
remembered child without animating through intermediate siblings. A drag can
interrupt settlement at the current fractional position; rapid tab commands keep the latest pending
selection. Horizontal motion is UI-thread gesture/transform animation, not
system-native paging physics, so physical-device feel needs separate validation.
Keep scene-wide trade/header content outside this horizontal component.

The caller owns the **only native vertical scroll surface**, not the only
VirtualizedList instance. Render the pager inside its real list cell so
same-orientation child VirtualizedLists inherit that context. The retained
leaves keep their own virtualization and measurement; React Native renders
their scroll container as a plain View under the shared outer list context.
The app's `LinkedScenePagerList` demonstrates this integration and supplies
activity boundaries. Leaf `active` includes visible previews; `interactive`
is restricted to the settled page. Pause inactive subscriptions using these
contexts without freezing native layout measurement.

`ref.selectPath(path)` selects an explicit child, while `selectTab(key)`
restores that group's remembered child. Flat gestures use child adjacency
inside the current group; parent entry never selects a child by direction.
For example, Basic → click Account → swipe back returns to Basic, not
Conditional. Page existence comes only from `pages`, never row
counts; keep zero-row children when their tabs remain visible.

Keys must be non-empty and unique within their level. Internal physical keys
encode the path without delimiter collisions. Invalid controlled paths are
normalized after topology changes. A topology change remounts the horizontal
owner, but not the caller's vertical list. Changing `pagingMode` requires an
explicit remount. Neither path issues vertical `scrollTo` commands.
An established viewport-width change cancels and remounts the horizontal
owner at the last committed path, retaining group memory and the external
vertical list; in-flight pixel coordinates are never replayed at the new width.

## Root full-screen pages

`RootScenePager` is a separate full-viewport horizontal track for independent
screens such as Swap and Bridge. It does not use the collapsible provider,
add a vertical scroller, align offsets, or join an inner linked-page sequence.
Each retained keyed child keeps its own native vertical surface and form state.

- `requestedKey` is a changed-value command; `onSettled(key)` publishes only
  the completed selection. Echoing that selection does not restart motion.
- `renderPage(key, {selected, visible, interactive})` separates business activity
  from preview visibility. The source remains selected during a drag; a cancelled
  preview does not activate the target. Only the settled page is interactive.
- Motion and snapping stay on the UI thread. JS receives transition boundaries,
  not frame-by-frame position updates. A new drag can grab fractional motion,
  and a command received during a touch is applied after that touch finishes.
- Width changes cancel old pixel geometry without changing child keys. Keep keys
  stable and unique. The host is responsible for deciding when expensive child
  content mounts; retention alone does not pause subscriptions or effects.
- `enabled` gates horizontal gestures, not route commands. The host must gate
  gestures for focus, keyboard, and blocking presentation as appropriate.

Wrap sliders, text-selection surfaces, charts, or an inner pager in
`RootScenePagerGestureBlock`. The root checks the selected page's native bounds
at DOWN, before a competing JS responder can lose arbitration. Unmeasured
selected-page exclusions fail closed. Outside a root it is an ordinary View,
with the same style/layout props. This is gesture isolation, not business-state
or subscription management.

The app's Root SubScreen playground exercises independent scrolling, retained
inputs, slider exclusion and preview motion. Jest covers motion/state contracts;
native gesture arbitration and frame time require device validation.

## Status

- v0: provider, shared scroll value, per-tab handles, the three layer
  primitives, `SceneScrollView`.
- v1: `SceneList`, `pinTop` for stacked pinned layers, shared-offset activation.
- v2: retained two-level `LinkedScenePager` with flat/nested gesture routing,
  nested presentation and one shared group header.
- v3 prototype: independent `RootScenePager` and native-measured child exclusions.
