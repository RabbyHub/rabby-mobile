import { useIsFocused } from '@react-navigation/native';
import React, { type ComponentType } from 'react';

import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import { RenderActivityAuditBoundary } from './RenderActivityAuditBoundary';

export function withScreenRenderActivityAudit<Props extends object>(
  Screen: ComponentType<Props>,
  label: string,
) {
  if (!isNonProductionDiagnosticsEnabled) {
    return Screen;
  }

  function ScreenWithRenderActivityAudit(props: Props) {
    const active = useIsFocused();

    return (
      <RenderActivityAuditBoundary active={active} label={label}>
        <Screen {...props} />
      </RenderActivityAuditBoundary>
    );
  }

  ScreenWithRenderActivityAudit.displayName = `withScreenRenderActivityAudit(${
    Screen.displayName || Screen.name || 'Screen'
  })`;

  return ScreenWithRenderActivityAudit;
}
