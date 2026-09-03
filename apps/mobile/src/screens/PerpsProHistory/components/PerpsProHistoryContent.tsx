import React from 'react';

import { usePerpsProTradeAmountUnit } from '@/screens/PerpsPro/scene/usePerpsProTradePreferences';

import { usePerpsProHistoryController } from '../scene/usePerpsProHistoryController';
import type { PerpsProHistoryTab } from '../types';
import { PerpsProHistoryPager } from './PerpsProHistoryPager';

export const PerpsProHistoryContent: React.FC<{
  active: boolean;
  initialTab?: PerpsProHistoryTab;
  scrollHost?: 'bottomSheet' | 'screen';
}> = ({ active, initialTab = 'orders', scrollHost = 'screen' }) => {
  const amountUnit = usePerpsProTradeAmountUnit();
  const history = usePerpsProHistoryController(initialTab, active);

  return (
    <PerpsProHistoryPager
      active={active}
      activeTab={history.activeTab}
      amountUnit={amountUnit}
      onChange={history.setActiveTab}
      onLoadEarlier={history.loadEarlier}
      onRefresh={history.refresh}
      scrollHost={scrollHost}
      state={history.state}
    />
  );
};
