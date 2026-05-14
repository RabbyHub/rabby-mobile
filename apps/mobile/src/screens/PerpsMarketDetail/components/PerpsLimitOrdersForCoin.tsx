import React from 'react';
import { Leverage } from '@rabby-wallet/hyperliquid-sdk';

import { PerpsLimitOrdersSectionView } from '@/screens/Perps/components/PerpsLimitOrdersSection/SectionView';
import { useDetailLimitOrders } from '@/screens/Perps/hooks/useLimitOrders';

type Props = {
  coin: string;
  leverage: Leverage | null;
  handleActionApproveStatus: () => Promise<void>;
};

export const PerpsLimitOrdersForCoin: React.FC<Props> = ({
  coin,
  leverage,
  handleActionApproveStatus,
}) => {
  const rows = useDetailLimitOrders(coin, leverage);
  return (
    <PerpsLimitOrdersSectionView
      rows={rows}
      handleActionApproveStatus={handleActionApproveStatus}
    />
  );
};
