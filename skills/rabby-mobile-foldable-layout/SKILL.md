---
name: rabby-mobile-foldable-layout
description: Keep sizing, spacing and centering correct when the native window is wider than the app content column (iPhone Duo outer screen and other letterboxed / foldable postures). Use when adding fixed sizes, absolute or full-screen layers, modals and overlays, or when an element looks shifted, stretched, non-square, or sits under the system control column on the Duo.
---

# Foldable and letterboxed layout

## Why this exists

On the iPhone Duo outer screen the native window is 466pt wide, but the app
draws inside a 382pt content column: `SafeWindowFrame` publishes the reduced
width through `Dimensions.set` and pads screens with `useSystemColumnInset()`.
The 84pt strip on the right is the system control column (clock, radio, camera)
and is not part of the app's layout.

Two different numbers therefore exist at runtime:

| Value | Duo outer | Plain phone |
| --- | --- | --- |
| Native window / full-bleed width | 466pt | = screen width |
| Content column (`useWindowDimensions()`) | 382pt | = screen width |

On a plain phone they are equal, so a mismatch is invisible there and only
shows up on the Duo. Always validate on the Duo posture, and measure rather
than only eyeballing a screenshot.

## Rules

1. **One width source per component.**
   Size from the reactive `useWindowDimensions()` from `@/core/dimensions`, or
   from a container's `onLayout`. Do **not** size from
   `getDimensionsSnapshot()` inside a memoized style factory, a module-scope
   constant, or an initial `useMemo`: `svsLayout` is filled by a deferred
   startup task, so those reads can keep the pre-letterbox 466pt.

2. **Coupled sizes must share the source.**
   A container and the child that constrains it (card ↔ QR, slot ↔ sliding
   plate, row ↔ item) must derive from the same value. Mixing a memoized style
   (466-based) with an inline computation (382-based) is what makes a card grow
   to 342pt while its QR stays 238pt.

3. **Express geometry, do not infer it.**
   Squares, equal halves and equal gaps should be explicit (`width`/`height`,
   `aspectRatio`, `flex: 1`), not the by-product of `padding` plus whatever the
   inner component happens to render.

4. **Center against the content column, not the window.**
   Ordinary screens are already inside that column. Full-window layers —
   transparent `Modal`, absolute overlays, toasts, popovers, drawers, full-screen
   loading — center on the native window by default and land 42pt too far right
   on the Duo. Inset them with `useSystemColumnInset()` (for example
   `paddingRight: columnInset.right` on the overlay).

5. **Full-bleed layers are the one exception.**
   Backgrounds, gradients, dividers and edge-to-edge cards should span the
   whole window (`left: 0; right: 0`) so they run under the system column. They
   must use the full window width, never the content width.

6. **Verify numerically.**
   Content right edge = window width − system column. Nothing but a rule-5 layer
   may cross it, and a row of segments must satisfy
   `leading padding + Σ(item widths) + Σ(gaps) = content width`
   (the Home indicator is `20 + 165 + 12 + 165 + 20 = 382`).

One-line summary: **only background layers span the whole window; every other
size, gap and center is based on the content column, from a single reactive
width.**

## Where the primitives live

- `apps/mobile/src/components/SafeWindowFrame/` — publishes the letterboxed
  width and exposes `useSystemColumnInset()` / the backdrop context.
- `apps/mobile/src/core/dimensions.ts` — `useWindowDimensions()` (reactive,
  correct) and `getDimensionsSnapshot()` (non-reactive, deferred sync).
- `apps/mobile/src/components2024/ScreenContainer/NormalScreenContainer.tsx` —
  applies the system-column padding to normal screens.

## Known cases fixed by this rule

- Home token-detail background: sized from a snapshot and anchored `right: 0`,
  leaving an 84pt bare strip on the left.
- Home asset tab strip: rode in by the content width while its container spans
  the window, leaving a slice parked under the system column.
- Home indicator: memoized style captured 466 → black bar 207pt against a
  135pt grey bar instead of 165/165.
- Address-detail QR sheet: memoized card width 342pt against a 238pt QR gave
  52pt side margins instead of 10pt, and centered on the window instead of the
  content column.
