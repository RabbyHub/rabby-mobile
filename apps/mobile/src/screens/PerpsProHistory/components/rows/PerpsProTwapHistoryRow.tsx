import React, { useEffect, useState } from 'react';
import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import { PerpsProTwapCard } from '@/screens/PerpsPro/components/twap/PerpsProTwapCard';
import { PerpsProTwapDetailSheet } from '@/screens/PerpsPro/components/twap/PerpsProTwapDetailSheet';
import type { PerpsProTwapHistoryRow } from '../../types';

export const PerpsProTwapHistoryRowView = React.memo(
  ({
    row,
    amountUnit,
    active,
  }: {
    row: PerpsProTwapHistoryRow;
    amountUnit: PerpsProTradeAmountUnit;
    active: boolean;
  }) => {
    const [detail, setDetail] = useState(false);
    useEffect(() => {
      if (!active) setDetail(false);
    }, [active]);
    return (
      <>
        <PerpsProTwapCard
          history
          order={row.order}
          amountUnit={amountUnit}
          now={row.time}
          active={active}
          onDetail={() => setDetail(true)}
        />
        {detail && active ? (
          <PerpsProTwapDetailSheet
            key={`${row.order.state.user}:${row.key}`}
            history
            order={row.order}
            onClose={() => setDetail(false)}
          />
        ) : null}
      </>
    );
  },
);
PerpsProTwapHistoryRowView.displayName = 'PerpsProTwapHistoryRowView';
