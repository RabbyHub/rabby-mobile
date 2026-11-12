import { getDirectOverlayPhase } from './directOverlay';
import { signatureReducer } from './machine';
import type { SignatureFlowState } from './types';

function directState(status: SignatureFlowState['status']): SignatureFlowState {
  return {
    status,
    fingerprint: 'fp',
    ctx: { mode: 'direct', txs: [{}] } as SignatureFlowState['ctx'],
  };
}

describe('direct signing overlay', () => {
  it('is shown only while a direct prefetch or signing is in flight', () => {
    expect(getDirectOverlayPhase(directState('prefetching'))).toBe(
      'prefetching',
    );
    expect(getDirectOverlayPhase(directState('signing'))).toBe('signing');

    (
      [
        'idle',
        'ready',
        'prefetch_failure',
        'ui-open',
        'completed',
        'error',
      ] as SignatureFlowState['status'][]
    ).forEach(status => {
      expect(getDirectOverlayPhase(directState(status))).toBeNull();
    });
  });

  it('is never shown outside direct mode', () => {
    const state = directState('signing');
    expect(
      getDirectOverlayPhase({
        ...state,
        ctx: { ...state.ctx, mode: 'ui' } as SignatureFlowState['ctx'],
      }),
    ).toBeNull();
    expect(getDirectOverlayPhase({ status: 'signing' })).toBeNull();
  });
});

describe('END_DIRECT', () => {
  it('returns an interrupted direct signing to a ready, non-direct state', () => {
    const next = signatureReducer(directState('signing'), {
      type: 'END_DIRECT',
    });

    expect(next.status).toBe('ready');
    expect(next.ctx?.mode).toBe('ui');
    expect(getDirectOverlayPhase(next)).toBeNull();
  });

  it('keeps a failure status and only leaves direct mode', () => {
    const next = signatureReducer(directState('prefetch_failure'), {
      type: 'END_DIRECT',
    });

    expect(next.status).toBe('prefetch_failure');
    expect(next.ctx?.mode).toBe('ui');
  });

  it('does not touch a state that is not in direct mode', () => {
    const state: SignatureFlowState = {
      status: 'signing',
      fingerprint: 'fp',
      ctx: { mode: 'ui', txs: [{}] } as SignatureFlowState['ctx'],
    };

    expect(signatureReducer(state, { type: 'END_DIRECT' })).toBe(state);
  });
});
