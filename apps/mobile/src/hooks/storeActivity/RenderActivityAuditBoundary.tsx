import React, {
  createContext,
  Profiler,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from 'react';

import {
  createRenderActivityAuditScope,
  registerRenderActivityAuditScope,
  type RenderActivityAuditScope,
} from '@/core/state/renderActivityAudit';
import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';

type RenderActivityAuditContextValue = {
  active: MutableRefObject<boolean>;
  lastCommittedActive: MutableRefObject<boolean>;
  scope: RenderActivityAuditScope;
};

const RenderActivityAuditContext = createContext<
  RenderActivityAuditContextValue | undefined
>(undefined);

type RenderActivityAuditRegistrationProps = {
  active: boolean;
  children: ReactNode;
  label: string;
};

export function RenderActivityAuditRegistration({
  active,
  children,
  label,
}: RenderActivityAuditRegistrationProps) {
  if (!isNonProductionDiagnosticsEnabled) {
    return children;
  }

  return (
    <EnabledRenderActivityAuditRegistration active={active} label={label}>
      {children}
    </EnabledRenderActivityAuditRegistration>
  );
}

function EnabledRenderActivityAuditRegistration({
  active,
  children,
  label,
}: RenderActivityAuditRegistrationProps) {
  const contextRef = useRef<RenderActivityAuditContextValue | null>(null);
  const hasCommittedRef = useRef(false);

  if (!contextRef.current) {
    contextRef.current = {
      active: { current: active },
      lastCommittedActive: { current: active },
      scope: createRenderActivityAuditScope({ active, label }),
    };
  }

  const context = contextRef.current;
  context.active.current = active;

  useLayoutEffect(() => {
    const previousActive = context.lastCommittedActive.current;
    context.scope.setActive(active);

    if (hasCommittedRef.current && !active && previousActive === active) {
      context.scope.recordParentUpdate();
    }

    context.lastCommittedActive.current = active;
    hasCommittedRef.current = true;
  });

  useEffect(() => registerRenderActivityAuditScope(context.scope), [context]);

  return (
    <RenderActivityAuditContext.Provider value={context}>
      {children}
    </RenderActivityAuditContext.Provider>
  );
}

export function RenderActivityAuditProfiler({
  children,
}: {
  children: ReactNode;
}) {
  const context = useContext(RenderActivityAuditContext);

  const onRender = useCallback<ProfilerOnRenderCallback>(
    (_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      if (!context) {
        return;
      }

      context.scope.recordSubtreeCommit({
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        activityTransition:
          context.active.current !== context.lastCommittedActive.current,
      });
    },
    [context],
  );

  if (!isNonProductionDiagnosticsEnabled || !context) {
    return children;
  }

  return (
    <Profiler id={context.scope.getDiagnostics().label} onRender={onRender}>
      {children}
    </Profiler>
  );
}

type RenderActivityAuditBoundaryProps = {
  active: boolean;
  children: ReactNode;
  label: string;
};

/** Observes an activity scope without changing subscription or render behavior. */
export function RenderActivityAuditBoundary({
  active,
  children,
  label,
}: RenderActivityAuditBoundaryProps) {
  if (!isNonProductionDiagnosticsEnabled) {
    return children;
  }

  return (
    <RenderActivityAuditRegistration active={active} label={label}>
      <RenderActivityAuditProfiler>{children}</RenderActivityAuditProfiler>
    </RenderActivityAuditRegistration>
  );
}
