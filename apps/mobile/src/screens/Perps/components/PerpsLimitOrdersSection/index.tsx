import React from 'react';

import { PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';

import { PerpsLimitOrdersSectionView } from './SectionView';
import { useHomeLimitOrders } from '../../hooks/useLimitOrders';

type Props = {
  positionAndOpenOrders?: PositionAndOpenOrder[];
  handleActionApproveStatus: () => Promise<void>;
};

export const PerpsLimitOrdersSection: React.FC<Props> = ({
  positionAndOpenOrders,
  handleActionApproveStatus,
}) => {
  const rows = useHomeLimitOrders(positionAndOpenOrders);
  return (
    <PerpsLimitOrdersSectionView
      rows={rows}
      handleActionApproveStatus={handleActionApproveStatus}
    />
  );
};
