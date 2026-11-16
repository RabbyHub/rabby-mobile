---
name: root-scene-pager-gesture-modes
description: Use when a retained root-scene pager (RootScenePager / retained full screens) coexists with the platform back gesture on iOS, when horizontal paging and "swipe back" compete, or when choosing between edge-handoff (A) and boundary-handoff (B) gesture contracts.
---

# Root Scene Pager Gesture Modes

`RootScenePager` pages between retained root sub-screens (Perps Simple/Pro,
Swap/Bridge, …) with a UI-thread manual pan. On iOS the root navigation stack
owns the interactive pop gesture, and its screen-edge pan wins any drag that
starts on the left edge. A pager that claims every horizontal drag therefore
swallows "swipe right = go back" (issue 1400: Swap page right-swipe did not
return Home).

The pager exposes two contracts, selected with
`gestureMode?: 'edge-handoff' | 'boundary-handoff'` and
`backGestureEdge?: number` (default 20pt on iOS, 0 elsewhere):

## Mode A — `edge-handoff` (default, recommended)

- The pager fails every **rightward** drag that starts inside the back-gesture
  edge (`backGestureEdge`); the native root-stack pop owns it.
- Every other horizontal drag pages between sub-screens.
- Same meaning on every page: **edge = back, in-page = change sub-screen**.
  On the last page an edge swipe still goes back, not to the previous page.
- Hosts should also keep the root gesture explicitly enabled while the pager is
  mounted (see `useRootScenePagerBackGesture`). The pager's fail is the first
  half, the explicit enable is the second half of the guarantee.

Use A unless a product requirement says "only the first sub-screen behaves like
the native back gesture".

## Mode B — `boundary-handoff`

- The pager claims all horizontal drags except the two boundaries: the **first
  page's rightward drag** and the **last page's leftward drag** fail to the
  parent.
- Only the first page is "consistent with the iOS back gesture"; a right swipe
  on later pages pages back to the previous sub-screen (Bridge → Swap,
  Pro → Simple) instead of leaving the screen.
- Because the native root-stack pan always wins an edge drag, B **requires the
  host to disable the root `gestureEnabled` while the pager is not on its first
  page** (and re-enable it on the first page). Without that coordination, edge
  swipes on later pages still pop the whole screen.

Use B only when the product explicitly wants the first-page-only semantics.

## Host Responsibilities

`RootScenePager` cannot touch navigation. Each host must:

1. Pass the mode explicitly, e.g.
   `gestureMode={ROOT_PAGER_GESTURE_MODE}`;
2. Call `useRootScenePagerBackGesture({ gestureMode, atFirstPage })`
   (`apps/mobile/src/hooks/useRootScenePagerBackGesture.ts`). It syncs the
   **root parent** navigation, not the child stack:
   - A: always `gestureEnabled: true`;
   - B: `gestureEnabled: atFirstPage`;
   - restores `true` on unmount.

`atFirstPage` is the settled page, not the requested one:
`settledTab === 'swap'` for Swap/Bridge, `mode.settledMode === 'simple'` for
Perps.

## Implementation Map

- `packages/rn-collapsible-scene-view/src/RootScenePager.tsx` — manual
  activation; calls `resolveRootSceneDragClaim` and fails/activates from it.
- `packages/rn-collapsible-scene-view/src/rootScenePagerModel.ts` —
  `RootScenePagerGestureMode`, `resolveRootSceneDragClaim` (pure worklet).
- `apps/mobile/src/hooks/useRootScenePagerBackGesture.ts` — root gesture sync.
- Hosts: `apps/mobile/src/screens/SwapBridge/index.tsx`,
  `apps/mobile/src/screens/Perps/PerpsRootPager.tsx`.

## Verification Checklist (iOS device)

Mode A:

- Swap: edge right → Home; in-page right → nothing; left → Bridge.
- Bridge: edge right → Home; in-page right → Swap.
- Perps Simple: edge right → Home; left → Pro.
- Perps Pro: edge right → Home; in-page left/right → Simple/Pro.

Mode B:

- Swap/Simple: edge right → Home; in-page right → nothing; left → next page.
- Bridge/Pro: right (edge or in-page) → previous sub-screen; left → nothing.
- Android: `backGestureEdge` is 0, so both modes keep the full claim; the
  system back gesture is not part of this contract.

## Constraints

- Do not put the pager inside a route whose root `gestureEnabled` the host
  cannot control; B silently degrades to A otherwise.
- Keep `resolveRootSceneDragClaim` pure and unit-tested
  (`rootScenePagerModel.test.ts`, `manual-activation claim` block). Device
  verification is still required: native gesture precedence cannot be proven in
  Jest.
- Do not implement mode B by disabling the native pop for the whole screen
  lifetime: the first page must keep it.
- Gesture-blocked native inputs (`RootScenePagerGestureBlock`) still win at
  DOWN; the new boundary logic only applies after the 8pt slop and the
  horizontal/vertical verdict.
