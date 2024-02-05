import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { ProtocolList } from './components/ProtocolList';
import { useQueryProjects } from './hooks';

export const DefiScreen = () => {
  const { currentAccount } = useCurrentAccount();
  const { portfolios, hasPortfolios, isPortfoliosLoading, refreshPositions } =
    useQueryProjects(currentAccount!.address, false, true);

  return (
    <ProtocolList
      portfolios={portfolios}
      isPortfoliosLoading={isPortfoliosLoading}
      hasPortfolios={hasPortfolios}
      tokenNetWorth={0}
      refreshPositions={refreshPositions}
    />
  );
};
