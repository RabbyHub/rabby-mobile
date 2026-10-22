import type { DisplayStatus, ExecLeg, LegPhase, LegState } from './types';

const IN_PROGRESS: LegPhase[] = ['preparing', 'confirming'];

const PHASE_TO_STATUS: Record<Exclude<LegPhase, 'queued'>, DisplayStatus> = {
  idle: 'pending',
  preparing: 'executing',
  confirming: 'executing',
  arriving: 'executing',
  success: 'success',
  failed: 'failed',
  cancelled: 'hidden',
};

export const getLegDisplayStatuses = (
  legs: ExecLeg[],
  states: Record<string, LegState | undefined>,
): Record<string, DisplayStatus> => {
  const busyChains = new Set(
    legs
      .filter(l => IN_PROGRESS.includes(states[l.key]?.phase ?? 'idle'))
      .map(l => l.pay.chain),
  );

  return Object.fromEntries(
    legs.map(leg => {
      const phase = states[leg.key]?.phase ?? 'idle';
      if (phase === 'queued') {
        return [
          leg.key,
          busyChains.has(leg.pay.chain) ? 'pendingPrevious' : 'pending',
        ];
      }
      return [leg.key, PHASE_TO_STATUS[phase]];
    }),
  );
};

export const countFinishedLegs = (
  states: Record<string, LegState | undefined>,
) =>
  Object.values(states).filter(
    s => s?.phase === 'success' || s?.phase === 'failed',
  ).length;
