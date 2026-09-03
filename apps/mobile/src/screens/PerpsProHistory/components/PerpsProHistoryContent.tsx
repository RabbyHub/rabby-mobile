import React from 'react';

import { usePerpsProTradeAmountUnit } from '@/screens/PerpsPro/scene/usePerpsProTradePreferences';

import { usePerpsProHistoryController } from '../scene/usePerpsProHistoryController';
import type { PerpsProHistoryTab } from '../types';
import { PerpsProHistoryPager } from './PerpsProHistoryPager';

export type PerpsProHistoryController = ReturnType<
  typeof usePerpsProHistoryController
>;

export const PerpsProHistoryContentView: React.FC<{
  active: boolean;
  history: PerpsProHistoryController;
  scrollHost?: 'bottomSheet' | 'screen';
}> = ({ active, history, scrollHost = 'screen' }) => {
  const amountUnit = usePerpsProTradeAmountUnit();

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

export const PerpsProHistoryContent: React.FC<{
  active: boolean;
  initialTab?: PerpsProHistoryTab;
  scrollHost?: 'bottomSheet' | 'screen';
}> = ({ active, initialTab = 'orders', scrollHost = 'screen' }) => {
  const history = usePerpsProHistoryController(initialTab, active);

  return (
    <PerpsProHistoryContentView
      active={active}
      history={history}
      scrollHost={scrollHost}
    />
  );
};
