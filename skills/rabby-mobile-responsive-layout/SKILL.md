---
name: rabby-mobile-responsive-layout
description: Use when a Rabby Mobile style needs a narrow-screen or multi-language layout variant, when a row/chip/badge wraps or overflows on a small iPhone, or when a layout change must not alter wider screens. Carries the iPhone logical-size ladder and the rule for gating narrow-screen tweaks.
---

# Responsive layout: narrow widths and long locales

A layout fix for one device must not silently restyle every other device.
Gate narrow-screen adjustments on the window width and compare against the
iPhone width ladder below.

## Source of truth in code

`apps/mobile/src/constant/layout.ts` exports:

- `IPHONE_SCREEN_TIERS` — logical portrait sizes in points, grouped by width;
- `NARROW_SCREEN_MAX_WIDTH = 375` — the narrowest tier still shipping;
- `isNarrowScreenWidth(width)` — the gate to use inside styles.

`useTheme2024({ getStyle })` passes `windowWidth` into the style factory, so
the variant stays reactive to rotation and fold changes:

```tsx
const getStyle = createGetStyles2024(({ colors2024, windowWidth }) => ({
  container: {
    paddingHorizontal: isNarrowScreenWidth(windowWidth) ? 4 : 6,
  },
}));
```

## iPhone width ladder (portrait, points)

Data compiled from Apple device specifications (ios-resolution.com, checked
2026-11-20). Width is what horizontal layout must survive.

| Width | Heights | Devices |
| --- | --- | --- |
| 320 | 480, 568 | iPhone 4/4S; iPhone 5/5S/5C/SE 1st |
| 375 | 667, 812 | iPhone 6/6s/7/8/SE 2nd/SE 3rd; iPhone X/XS/11 Pro/12 mini/13 mini |
| 390 | 844 | iPhone 12/12 Pro/13/13 Pro/14/16e/17e |
| 393 | 852 | iPhone 14 Pro/15/15 Pro/16 |
| 402 | 874 | iPhone 16 Pro/17/17 Pro/18 Pro |
| 414 | 736, 896 | iPhone 6/6s/7/8 Plus; iPhone XR/XS Max/11/11 Pro Max |
| 420 | 912 | iPhone Air |
| 428 | 926 | iPhone 12/13 Pro Max; iPhone 14 Plus |
| 430 | 932 | iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus |
| 440 | 956 | iPhone 16 Pro Max/17 Pro Max/18 Pro Max |

Android phones can be narrower than the narrowest iPhone: Galaxy S class is
360dp. The same `<= 375` gate covers them.

## Rules

1. **Never tighten a shared style globally for a single narrow tier.** A
   padding/gap/font change made for 375pt changes every screen at 390pt+.
   Put the compact values behind `isNarrowScreenWidth(windowWidth)` and keep
   the original values in the `else` branch.
2. **Arrows are layout, not content.** A trailing chevron is always the full
   16×16 icon at the row's right edge: give it `flexShrink: 0` (and a `gap` on
   the row) and let the text side absorb the width. Its position must be
   identical in every locale — verify by measuring the glyph x-range across
   languages, it must not move with the translated copy.
3. **English is the fixed design baseline.** Copy that comes from an i18n key
   and resolves to English must render with fixed metrics: no measuring, no
   auto-shrink, no reflow. `AutoFitText` (`components/AutoFitText.tsx`)
   implements this — pass `i18nKey`, and English takes the fixed path
   automatically (`forceAutoFit` exists only for tests/playgrounds). Other
   languages use its adaptive path and shrink to fit instead of wrapping.
   - iOS: native `adjustsFontSizeToFit` + `minimumFontScale`.
   - Android: the platform ignores those props, so the text is measured once
     (`onTextLayout`) and the font size steps down until it fits.
   Row labels may take `numberOfLines={2}`; a tappable text row (e.g. "Add
   wallet from this seed phrase") may wrap and grow vertically with the arrow
   staying centred in its fixed slot. A labelled value row keeps the label at
   its natural width (`flexShrink: 0`) so words never break mid-way, and caps
   the value at two lines with a tail ellipsis, letting the row grow.
4. **Long locales are a width problem, not only a copy problem.** Measure the
   worst-case language (ru/es/pt/fr are the longest) on the narrowest device
   before accepting a layout. Do not rewrite translations to make a layout fit
   unless the product owner asks for shorter copy.
5. **Verify at the tier boundaries.** Confirm the narrow variant on a 375pt
   device and the regular variant on a >=390pt device; a same-device check
   cannot prove the gate works.
