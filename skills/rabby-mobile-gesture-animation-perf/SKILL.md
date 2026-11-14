---
name: rabby-mobile-gesture-animation-perf
description: Design gesture-driven animation on the Rabby Mobile UI runtime so swipe-following chrome, tab highlights and pager state stop re-entering React. Use when a change animates from a gesture or shared value, when a chrome swap or highlight should track the finger, or when a settle visibly snaps back or jitters on Android.
---

# Rabby Mobile Gesture And Animation Performance

This guide covers animation whose input is a gesture or a continuous shared
value: pager tracks, header/chrome swaps, tab highlight, collapsible scenes.
React subscription design lives in `apps/mobile/skills/perf-hooks.md`; route
through `skills/rabby-mobile-performance-review/SKILL.md` first.

The recurring failure is not a slow animation. It is animation state that
leaves the UI runtime, so a value the finger already produced has to come back
through JS before anything visible happens.

## 1. One shared value, read on the UI runtime

Derive every gesture-following visual from the pager's own shared value inside
`useAnimatedStyle` / worklets.

- Do not mirror that value into React state and pick a style from it. A
  `useValueFromSharedValue` + `useMemo` pair reintroduces a JS round trip and
  collapses a continuous track into a discrete flip at a threshold.
- When several forms must swap, animate a band centred on the point where the
  pager actually decides, keep adjacent forms summing to 1 so the band never
  shows a blank or a double exposure, and ease the flanks so two forms do not
  sit half-and-half for long.
- Mount shared elements once and pin them outside the swap. Only the group that
  really changes should cross-fade.
- Evidence: `ed53bc381` turned the Home header forms and the balance label with
  the finger instead of waiting for the settle commit and flipping at 0.5 page.

## 2. One writer for the visible index

Split *commanding* a tab change from *publishing* one that already happened.

- A command (tap, programmatic jump) asks the pager to move.
- The pager's own callback publishes the settled index.
- The publish path must never call back into the pager: that re-enters the
  gesture and can overwrite an in-flight settle.
- Never write from JS a shared value that the UI callback also writes. The JS
  write lands a frame late and the highlight snaps back to the previous tab
  while the list is already on the new one.
- Evidence: `bbc9e4d51` made `setTabIndex` a command that only mirrors into the
  JS store, and added `publishSettledIndex` for the commit callback.

## 3. Keep layout static; animate opacity and transform only

- Do not write width, height, background colour or text props from a worklet.
  Only opacity/transform reach the shadow tree without a layout pass.
- Move a whole strip with the same track that moves the pages
  (`translateX = (1 - clamp(track, 0, 1)) * width`) so the row and the list
  read as one sheet instead of two independently animated parts.
- Gate hit-testing on arrival (`progress > 0.99`) instead of introducing another
  state that has to be published.
- Evidence: `4e17bdf5e` replaced a vertical drop plus fade with the shared
  horizontal ride.

## 4. Quantise animated translations to whole device pixels

Sub-pixel offsets re-rasterise translated text layers on every step, which
reads as horizontal shimmer or tremble; it is far more visible on Android than
on iOS.

- Snap inside the worklet with
  `Math.round(value * PixelRatio.get()) / PixelRatio.get()`.
- Clamp a nested element's input range to the phase where it is supposed to
  move. A nested element whose offset is derived from the raw track will travel
  at a different speed from its row and visibly separate from it.
- Evidence: `5c25e31e0`.

## 5. Third-party animation components

- Treat the component's internal track (for example a tab bar's
  `indexDecimal`) as owned by that component.
- Drive visual behaviour through props or shared values you own; do not write
  the same internal track from JS as well.
- A container whose width changes between states causes jitter no animation
  tuning can fix. Pin the container width first, then animate.

## Acceptance

- Keep a change only when a same-session interleaved A/B (>=3+3) shows fewer
  dropped frames / lower App Deadline Missed.
- Commit counts, mount counts and layout-pass counts are attribution tools, not
  acceptance criteria.
- Remove temporary probes once measured; record the number and the rejected
  variants in the investigation notes instead of leaving structure behind.
