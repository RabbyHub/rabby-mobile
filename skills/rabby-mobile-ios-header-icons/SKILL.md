---
name: rabby-mobile-ios-header-icons
description: Standardize the iOS navigation-bar item icons in Rabby Mobile. Use when adding or changing the native back button, the native header right items, or any icon that UIKit renders as a UIBarButtonItem (screen options `unstable_headerLeftItems` / `unstable_headerRightItems`), and when a header icon looks off-position or aliased on a specific iOS version.
---

# iOS header item icons

Anything UIKit draws as a `UIBarButtonItem` (the standard back button and the
native header right items) is a **bar item icon**. Maintain those as vector
asset-catalog images (`xcasset`), not as PNGs and not as SF Symbols.

Icons rendered by React Native itself (a `header:` / `headerLeft` custom
component, `react-native-svg`, ordinary `<Image>`) are out of scope: they are
already vector on the JS side and must keep their JS asset/theme/tint props.

Rule of thumb: **xcasset is only for icons whose layout UIKit owns.** Decide by
who renders the icon, not by where it sits in the header:

| Case | Use | Why |
| --- | --- | --- |
| Native bar item (`unstable_headerLeftItems` / `unstable_headerRightItems` with an image icon) | `xcasset` | Same UIKit layout / rasterization / tint rules as the back button; a PNG aliases and the position depends on the OS inset |
| JS `headerRight` component (e.g. `SendHeaderRight`, the Market search button) | `react-native-svg` | Already vector, and it carries dynamic colours, badges, state and animation that a static asset would lose |
| Fully custom header (`AutoFitCenterHeader`, `ImportMethodsHeader`, any `header:` component) | JS / `react-native-svg` | The whole row is rendered by React Native; xcasset buys nothing and forces a native rebuild for every tweak |

## Why

1. iOS 26 hands the bar item content a smaller leading inset than iOS 27
   (16pt vs 22pt). The same artwork therefore lands ~6pt further left on iOS 26
   (QA #1360). The fix is to shift the glyph inside the asset canvas, which needs
   an asset we fully control.
2. A `UIBarButtonItem` image is rasterized at the device scale. Binary-alpha PNG
   exports show stair-stepped diagonals (QA #1359); a vector asset is resolved by
   UIKit at any scale.
3. `template-rendering-intent: template` makes UIKit apply the bar tint colour,
   so one asset follows light/dark and every tint that the screen sets.
4. SF Symbols are **not** a substitute: `PlatformIconIOS` in
   `react-native-screens` 4.22 accepts only `{ type: 'sfSymbol', name }` (no
   weight / scale / pointSize), and the symbol carries ~8pt of optical padding
   that UIKit, not us, positions. Measured: 25.0pt on iOS 26.1 and 31.3pt on
   iOS 27 for `chevron.left`, versus 23.7pt for the xcasset artwork.

## Alignment principle

- The back control hugs the **leading edge of the page's main content**, and a
  trailing control hugs its **trailing edge** — i.e. they follow the content's
  horizontal padding (commonly 20pt), not the system bar-item inset.
- Exception: when the main content does not hug the edge (centred card,
  full-bleed image, edge-to-edge list), keep the system default position instead
  of forcing the control to the screen edge.
- The title is always **screen-centred**. On a native stack, achieve that with a
  custom header row (`[leading slot][flex:1 centred title][trailing slot]`) —
  not with the native `headerTitle` container, whose centre depends on the
  neighbouring bar items.

## Standard back button

- Source of truth: `apps/mobile/src/hooks/navigation.tsx` →
  `renderNativeBackItems`, wired into every screen through `mergeScreenOptions`
  / `mergeScreenOptions2024` as `unstable_headerLeftItems`.
- Assets: `apps/mobile/ios/RabbyMobile/Images.xcassets/`
  - `HeaderBackChevron` — 44×24 canvas, glyph at the leading edge (iOS 27+).
  - `HeaderBackChevronIOS26` — 50×24 canvas, glyph shifted 6pt right (iOS 26).
- Both imagesets are a single SVG with
  `"preserves-vector-representation": true` and
  `"template-rendering-intent": "template"`, stroke `#000000` (the template mask).
- Selection rule: `Platform.Version < 27` picks the iOS 26 variant and a 50pt
  item width; otherwise the 44pt variant is used. Keep the item width in sync
  with the asset canvas width.
- Target geometry: the glyph ink starts at **23.7pt** from the screen's leading
  edge on every iOS version. That is the number to measure, not the item frame.

## Adding a right-side native item

- Declare it with `unstable_headerRightItems` and an `xcasset` icon, following
  the same canvas / template / naming rules.
- A native right item list **replaces** a JS `headerRight` that the screen sets
  with `setNavigationOptions`. Do not add a native spacer to balance a title on a
  screen that already renders a JS `headerRight` — that silently removes the
  button (QA #2383 / PR #2383). Balance inside the JS `headerRight` instead.
- If the trailing control is a JS component, leave it as JS; only the icon that
  UIKit hosts needs an xcasset.

## Verification recipe

1. Debug build + Metro, open the screen on an iOS 26 simulator (26.1/26.5) and
   on iOS 27 (device or simulator).
2. Screenshot at 3x and measure the ink bounding box in the header band:
   the back glyph's leading edge must be 23.7pt on both.
3. Sample the darkest glyph pixel and compare it with a title pixel; they must
   match (proves the template tint is applied).
4. Check the same screen in dark mode: the icon must follow the tint, not stay
   black.

## Pitfalls

- Changing an asset catalog entry requires a **native rebuild**; JS hot reload
  does not update it. A JS build that references a missing `xcasset` renders no
  icon at all, so ship the asset and the JS change together.
- Keep the iOS 26 / iOS 27 canvases identical except for the 6pt horizontal
  shift; do not change the glyph size or stroke width between them.
- Do not reintroduce fixed `translateX`/`marginLeft` compensation on a JS
  headerLeft to chase this offset — that approach was rejected in #2335.
