import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { ProtocolList } from './components/ProtocolList';
import { useQueryProjects } from './hooks';

export const DefiScreen = () => {
  const { currentAccount } = useCurrentAccount();
  const { portfolios, hasPortfolios } = useQueryProjects(
    currentAccount!.address,
  );

  return (
    <ProtocolList
      portfolios={portfolios}
      hasPortfolios={hasPortfolios}
      tokenNetWorth={0}
    />
  );
};
