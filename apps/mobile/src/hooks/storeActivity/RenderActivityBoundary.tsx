import React, { memo, type ReactNode } from 'react';

import { StoreActivityBoundary } from './StoreActivityBoundary';

type InactiveRenderGateProps = {
  active: boolean;
  children: ReactNode;
};

const InactiveRenderGate = memo(
  function InactiveRenderGate({ children }: InactiveRenderGateProps) {
    return children;
  },
  (previous, next) => !previous.active && !next.active,
);

type RenderActivityBoundaryProps = {
  active: boolean;
  children: ReactNode;
  label: string;
};

/**
 * Keeps a mounted subtree intact while it is inactive, but stops both
 * activity-aware Store publication and parent-driven render propagation.
 */
export function RenderActivityBoundary({
  active,
  children,
  label,
}: RenderActivityBoundaryProps) {
  return (
    <StoreActivityBoundary active={active} label={label}>
      <InactiveRenderGate active={active}>{children}</InactiveRenderGate>
    </StoreActivityBoundary>
  );
}
