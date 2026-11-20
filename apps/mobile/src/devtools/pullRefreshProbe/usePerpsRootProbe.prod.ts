import type { ProfilerOnRenderCallback, ReactNode } from 'react';
import type { RootScenePagerProbe } from '@rabby-wallet/rn-collapsible-scene-view/src/rootScenePagerProbe';

export type PerpsRootProbe = {
  observer?: RootScenePagerProbe;
  onRender?: ProfilerOnRenderCallback;
  business?: (
    event: 'business-begin' | 'business-end',
    page: 'simple' | 'pro',
  ) => void;
};

const INACTIVE: PerpsRootProbe = Object.freeze({});

/** Public composition reaches no subscription, timer, native bridge or logger. */
export function usePerpsRootProbe(): PerpsRootProbe {
  return INACTIVE;
}

export type PerpsRootProbeProfilerProps = {
  page: 'simple' | 'pro';
  onRender?: ProfilerOnRenderCallback;
  children: ReactNode;
};

export function PerpsRootProbeProfiler({
  children,
}: PerpsRootProbeProfilerProps) {
  return children;
}
