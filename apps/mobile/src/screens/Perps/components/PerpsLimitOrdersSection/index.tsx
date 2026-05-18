import React from 'react';

import { PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';

import { PerpsLimitOrdersSectionView } from './SectionView';
import { useHomeLimitOrders } from '../../hooks/useLimitOrders';

type Props = {
  positionAndOpenOrders?: PositionAndOpenOrder[];
  handleActionApproveStatus: () => Promise<void>;
  isHome?: boolean;
};

export const PerpsLimitOrdersSection: React.FC<Props> = ({
  positionAndOpenOrders,
  handleActionApproveStatus,
  isHome,
}) => {
  const rows = useHomeLimitOrders(positionAndOpenOrders);
  return (
    <PerpsLimitOrdersSectionView
      rows={rows}
      isHome={isHome}
      handleActionApproveStatus={handleActionApproveStatus}
    />
  );
};
