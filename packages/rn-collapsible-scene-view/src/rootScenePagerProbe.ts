/** Optional diagnostic seam. No app dependencies or business payloads. */
export type RootScenePagerProbeEvent = {
  event:
    | 'drag-start'
    | 'release'
    | 'snap-start'
    | 'snap-cancelled'
    | 'ui-complete'
    | 'finalize'
    | 'command'
    | 'geometry'
    | 'publish-received'
    | 'publish-accepted'
    | 'publish-rejected';
  origin?: 'gesture' | 'finalize' | 'ui-command' | 'js-command' | 'geometry';
  epoch: number;
  fromEpoch?: number;
  command: number;
  selected?: number;
  target?: number;
  position?: number;
  settled?: boolean;
};

export type RootScenePagerProbe = {
  /** A worklet; it must only append to a bounded UI-memory buffer. */
  onUI: (event: RootScenePagerProbeEvent) => void;
  onJS: (event: RootScenePagerProbeEvent) => void;
};
