# rn-collapsible-scene-view

A small local package for "collapsed scene" layouts: one scroll surface per
tab, a scroll-away header region, and **multiple pinned layers** stacked on top
of each other.

It starts as a simplified re-implementation of
`react-native-collapsible-tab-view` (the repo patches that library for the Home
screen), and then adds what that library cannot express:

| capability | collapsible-tab-view | this package |
| --- | --- | --- |
| scroll-away header | yes | yes |
| single pinned tab bar | yes | yes |
| **several pinned layers stacked** | no | yes (`PinnedLayer`) |
| **content that scrolls away but stays above the pinned layers** | no | yes (`ScrollingLayer`) |
| per-tab offset memory on switch | yes | yes |
| horizontal paging | library pager | caller-owned pager (or none) |

## Model

All layers share one `scrollY` value that comes from the active tab's
`SceneScrollView` on the UI thread, so every layer moves in the same frame as
the list. There is no per-frame JS work and no overlay "chasing" the native
offset.

```
<CollapsibleSceneProvider headerHeight={H} activeTab={tab} onTabChange={fn}>
  <HeaderLayer />       translateY = -min(scrollY, H)        (collapses)
  <PinnedLayer baseTop={H} />   translateY = clamp(H - scrollY, 0, H)  (pins)
  <ScrollingLayer baseTop={H + marketH} />                     (scrolls away)
  <PinnedLayer baseTop={tabsTop} />                            (pins below)
  <Pager>
    <SceneScrollView tabKey="positions" contentInsetTop={H + marketH + tradeH}>
      …rows…
    </SceneScrollView>
  </Pager>
</CollapsibleSceneProvider>
```

## Status

- v0: provider, shared scroll value, per-tab offsets, the three layer
  primitives.
- next: horizontal pager integration helper, `onTabChange` preview support,
  keyboard inset handling.
