import React from 'react';
import { useTranslation } from 'react-i18next';

import { PerpsProInfoControls } from '../info/PerpsProInfoControls';

export const PerpsProPositionsControls: React.FC<{
  actionDisabled?: boolean;
  actionPending?: boolean;
  hideOtherSymbols: boolean;
  onCloseAll?: () => void;
  onToggleHideOtherSymbols: () => void;
}> = React.memo(({ actionDisabled, actionPending, onCloseAll, ...props }) => {
  const { t } = useTranslation();
  return (
    <PerpsProInfoControls
      actionDisabled={actionDisabled}
      actionLabel={t('page.perps.pro.positions.closeAll')}
      actionPending={actionPending}
      onAction={onCloseAll}
      testID="perps-pro-positions-controls"
      {...props}
    />
  );
});

PerpsProPositionsControls.displayName = 'PerpsProPositionsControls';
