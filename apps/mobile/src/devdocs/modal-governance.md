# Modal Governance (iOS Freeze Investigation)

## Why

Recent iOS freeze reports match a native `Modal` residue pattern:

1. Modal A opens.
2. Modal B opens while A is still active or closing.
3. B closes, A closes.
4. Screen becomes non-interactive (touches blocked by a stale native layer).

Android does not show the same severity in current repro paths.

## Root Cause and Native Fix (iOS)

RN's Fabric `RCTModalHostViewComponentView` presents every `Modal` from its
nearest view controller. When that controller is already presenting something
(another RN `Modal`, a `Tip`, a zeego menu, a system sheet) or is mid-transition,
UIKit refuses the presentation. Upstream still marks the modal as presented, so
its empty full-screen host view stays in the React hierarchy and swallows every
touch. It is often unnoticed until the sheets above it close, for example on
returning to Home.

Field repro (0.6.97): on the full sign page, open the GasAccount info `Tip`,
take a screenshot (feedback modal is rejected), close the Tip and the dapp
sheet. Home stops responding.

The `react-native` Yarn patch fixes this for every RN `Modal`, including
third-party ones (`react-native-walkthrough-tooltip`, RNEUI `Dialog`):

- A presentation that UIKit would refuse, or did refuse, waits and retries
  every 150 ms until the presenter is free. The modal then appears.
- The host view never receives touches. Its content lives in the presented
  controller.
- A modal hidden before it ever reached the screen still emits `onDismiss`, so
  JS unmounts it and `TrackedModal` releases its gate.

The JS gate below stays useful. It avoids the visible delay and keeps the open
order predictable, but a missing gate no longer freezes the app.

Dev repro: Regression Switches → "Open Tip -> Screenshot Modal".

## Invisible Modals (JS Rules)

A presented `Modal` blocks every touch below it. If it shows nothing, the user
sees the app but cannot touch it, and nothing on screen can close it. The
native fix above does not cover this: the modal is on screen, just empty.
Every `Modal` must therefore follow these rules:

- **Never present without content.** Gate `visible` on the data the content
  needs (`visible && !!data`), not only on a flag. Example: `QrCodeModal`.
- **A `Tip` without content does nothing.** Many screens wrap a button in
  `<Tip content={cond ? text : undefined}>`. Tapping the disabled button used
  to open an empty tooltip (Swap: tap the grey Confirm with no amount, and the
  page freezes). `Tip` now ignores empty content: it never opens, and taps go
  straight to its children.
- **Do not hide the tap-to-close layer with `opacity: 0`.** iOS skips views with
  `alpha < 0.01` during hit testing, so a hidden backdrop cannot receive the
  tap that closes it. `react-native-walkthrough-tooltip` did this until its
  content was measured; a `Tip` whose content never measured (empty content)
  froze the Swap page. The library patch now hides only the tooltip itself and
  keeps the container tappable, so every `Tip` closes on the next tap.
- **An intentionally invisible blocker must be bounded.** The MiniSign direct
  overlay is shown only for an allow-list of in-flight states (`prefetching`,
  `signing`; see `MiniSignV2/state/directOverlay.ts`), never by exclusion, and
  hides itself after a time limit. `SignatureManager` leaves direct mode
  whenever it rejects the caller.
- **Pass `onRequestClose`** whenever the modal has a close or cancel control,
  so Android back does the same thing.

Dev repro: Regression Switches → "Open Empty Tip". The next tap anywhere must
close it.

## Foundation Added

- `src/utils/modalGate.ts`
  - Global registry for visible blocking modals (`id -> count`).
  - Query API: `hasVisibleBlockingModal`, `getVisibleBlockingModalIds`.
  - Dev API:
    - `__dumpBlockingModalIds()`
    - `__dumpModalGateDebugSnapshot()`
- `src/components/Modal/TrackedModal.tsx`
  - Unified wrapper around RN `Modal`.
  - Automatically registers/unregisters visibility in `modalGate`.
- `src/screens/Settings/components/FloatingDiagnosticsPanel.tsx`
  - Dev-only floating diagnostics entry for autolock and currently visible blocking modal ids.
  - Enabled from Regression Switches.

## Current Guardrail

- Screenshot feedback modal open is gated in `src/components/Screenshot/hooks.ts`.
- If any other blocking modal is visible, screenshot feedback modal open is skipped.
- Goal: avoid risky stacked native modal transitions.

### Native menus (iOS)

An open zeego context/dropdown menu is a view controller presented on the root
view controller (`_UIContextMenuActionsOnlyViewController`). UIKit rejects any
RN `Modal` presented meanwhile ("Attempt to present ... which is already
presenting ..."), but the RN host view stays mounted full-screen with no
content and swallows every touch until the app restarts.

Every zeego menu `Root` must spread `useNativeMenuModalGate()` from
`src/utils/modalGate.ts` (`ContextMenuView` and `DropDownMenuView` already do).
It registers `MODAL_GATE_IDS.nativeMenu` from will-open until the menu has
fully hidden, so gated modals open after the menu closes. It also passes
`iosMenuViewRef`, so `dismissOpenNativeMenus()` can close open menus. A
screenshot taken while a menu is open does this, and its feedback modal opens
once the menu has hidden.

## Modal Types

### A) Blocking Native Modal (tracked)

Use `TrackedModal` with a stable `modalId`.

Use when:

- Full-screen blocking UX is required.
- Legacy flow still depends on RN `Modal`.

Requirements:

- Must use `TrackedModal`.
- Must use a unique `modalId` from `MODAL_GATE_IDS`.

### B) Non-blocking Overlay (preferred for new UI)

Use bottom-sheet/portal based overlays (single host).

Use when:

- Feature is in-app interaction panel, picker, or lightweight prompt.
- Native modal semantics are not required.

### C) Transitional Legacy Modal

Keep existing RN modal path but:

- move to `TrackedModal`,
- register a `modalId`,
- avoid stacked opens,
- add follow-up ticket to migrate to Type B.

## Immediate Migration Targets

Already on `TrackedModal` + registry:

- screenshot feedback
- rate guide modal
- swap shared modal wrapper
- security tip modal
- biometrics stub modal
- mini-sign direct transparent overlay
- alias name edit modal
- qr code modal
- duplicate address modal
- confirm set password modal
- address discard confirm modal
- sync extension no-new-addresses modal
- gas account switch-login-address modal
- gas account deposit-with-token alert modal
- perps agents-limit modal
- perps deposit-token modal
- repro modal in dev switches

Next wave:

- remaining perps modals
- remaining gas account modals
- settings dev modals
- address/import related confirmation modals
- receive / token detail / keystone related legacy modals

## Rules for New Code

1. Do not introduce raw RN `Modal` directly in feature code.
2. If RN `Modal` is necessary, use `TrackedModal`.
3. For transaction critical flows, avoid opening Modal B while Modal A is visible.
4. Prefer one global overlay host architecture for new interaction surfaces.
