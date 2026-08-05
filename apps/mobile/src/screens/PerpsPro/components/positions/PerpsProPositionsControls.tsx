import React from 'react';
import { useTranslation } from 'react-i18next';

import { PerpsProInfoControls } from '../info/PerpsProInfoControls';

export const PerpsProPositionsControls: React.FC<{
  hideOtherSymbols: boolean;
  onToggleHideOtherSymbols: () => void;
}> = React.memo(props => {
  const { t } = useTranslation();
  return (
    <PerpsProInfoControls
      actionLabel={t('page.perps.pro.positions.closeAll')}
      testID="perps-pro-positions-controls"
      {...props}
    />
  );
});

PerpsProPositionsControls.displayName = 'PerpsProPositionsControls';
