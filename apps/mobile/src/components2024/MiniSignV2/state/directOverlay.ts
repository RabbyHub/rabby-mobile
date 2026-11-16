import type { SignatureFlowState } from './types';

/**
 * Direct signing covers the screen with a transparent Modal so nothing can be
 * tapped while it works. The overlay is invisible, so it is only shown for the
 * two states in which work is in flight, and never longer than the limit
 * below. Any other state (failure, completed, a state added later) leaves the
 * screen usable.
 */
export const DIRECT_OVERLAY_MAX_MS = {
  prefetching: 30 * 1000,
  signing: 3 * 60 * 1000,
} as const;

export type DirectOverlayPhase = keyof typeof DIRECT_OVERLAY_MAX_MS;

export function getDirectOverlayPhase(
  state: Pick<SignatureFlowState, 'status' | 'ctx'>,
): DirectOverlayPhase | null {
  if (state.ctx?.mode !== 'direct') {
    return null;
  }
  if (state.status === 'prefetching' || state.status === 'signing') {
    return state.status;
  }
  return null;
}
