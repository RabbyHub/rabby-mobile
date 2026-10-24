# rn-collapsible-scene-view

A small local package for "collapsed scene" layouts: one scroll surface per
tab, a scroll-away header region, and **multiple pinned layers** stacked on top
of each other.

It starts as a simplified re-implementation of
`react-native-collapsible-tab-view` (the repo patches that library for the Home
screen), and then adds what that library cannot express:

| capability                                                      | collapsible-tab-view | this package                 |
| --------------------------------------------------------------- | -------------------- | ---------------------------- |
| scroll-away header                                              | yes                  | yes                          |
| single pinned tab bar                                           | yes                  | yes                          |
| **several pinned layers stacked**                               | no                   | yes (`PinnedLayer`)          |
| **content that scrolls away but stays above the pinned layers** | no                   | yes (`ScrollingLayer`)       |
| shared scene offset on switch                                   | no                   | yes                          |
| **virtualized list surface**                                    | yes                  | yes (`SceneList`)            |
| horizontal paging                                               | library pager        | caller-owned pager (or none) |

## Model

All layers share one `scrollY` value that comes from the active tab's
`SceneScrollView` on the UI thread, so every layer moves in the same frame as
the list. There is no per-frame JS work and no overlay "chasing" the native
offset.

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
thread. A page that becomes active is aligned to the current scene offset
(`syncOffsetOnActivate` defaults to `true`), so switching tabs cannot move the
shared header/market/trade layers.

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

## Status

### Retained linked pages

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
Keep trade/header content outside this horizontal component.

The caller owns the **only native vertical list**. Render the pager inside its
real list cell so same-orientation child VirtualizedLists inherit that context.
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

- v0: provider, shared scroll value, per-tab handles, the three layer
  primitives, `SceneScrollView`.
- v1: `SceneList`, `pinTop` for stacked pinned layers, shared-offset activation.
- v2: retained two-level `LinkedScenePager` with flat/nested gesture routing,
  nested presentation and one shared group header.
