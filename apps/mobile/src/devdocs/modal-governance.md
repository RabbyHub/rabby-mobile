# Modal Governance (iOS Freeze Investigation)

## Why

Recent iOS freeze reports match a native `Modal` residue pattern:

1. Modal A opens.
2. Modal B opens while A is still active or closing.
3. B closes, A closes.
4. Screen becomes non-interactive (touches blocked by a stale native layer).

Android does not show the same severity in current repro paths.

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
