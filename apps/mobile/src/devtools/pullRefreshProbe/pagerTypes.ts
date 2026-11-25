import type { RootScenePagerProbeEvent } from '@rabby-wallet/rn-collapsible-scene-view/src/rootScenePagerProbe';

/** Independent channel: never reinterpret Home geometry as pager data. */
export type PagerProbeRow = {
  event:
    | RootScenePagerProbeEvent['event']
    | 'business-begin'
    | 'business-end'
    | 'react-commit'
    | 'clock-anchor';
  domain: 'ui' | 'js';
  at: number;
  monoMs: number;
  sequence: number;
  epoch?: number;
  fromEpoch?: number;
  command?: number;
  selected?: number;
  target?: number;
  position?: number;
  settled?: boolean;
  origin?: RootScenePagerProbeEvent['origin'];
  page?: 'simple' | 'pro';
  phase?: 'mount' | 'update' | 'nested-update';
  actualDuration?: number;
  baseDuration?: number;
  startTime?: number;
  commitTime?: number;
  dropped?: number;
};
