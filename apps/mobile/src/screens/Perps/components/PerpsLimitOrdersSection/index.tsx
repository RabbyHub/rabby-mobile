import React from 'react';

import { PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';

import { PerpsLimitOrdersSectionView } from './SectionView';
import { useHomeLimitOrders } from '../../hooks/useLimitOrders';

type Props = {
  positionAndOpenOrders?: PositionAndOpenOrder[];
  handleActionApproveStatus: () => Promise<void>;
  isHome?: boolean;
  sceneActive?: boolean;
};

export const PerpsLimitOrdersSection: React.FC<Props> = ({
  positionAndOpenOrders,
  handleActionApproveStatus,
  isHome,
  sceneActive,
}) => {
  const rows = useHomeLimitOrders(positionAndOpenOrders);
  return (
    <PerpsLimitOrdersSectionView
      rows={rows}
      isHome={isHome}
      sceneActive={sceneActive}
      handleActionApproveStatus={handleActionApproveStatus}
    />
  );
};
