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

- v0: provider, shared scroll value, per-tab handles, the three layer
  primitives, `SceneScrollView`.
- v1: `SceneList`, `pinTop` for stacked pinned layers, shared-offset activation.
- next: horizontal pager integration helper, `onTabChange` preview support,
  keyboard inset handling.
