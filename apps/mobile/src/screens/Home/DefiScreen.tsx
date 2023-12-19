import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { Text, View } from 'react-native';
import { ProtocolList } from './components/ProtocolList';
import { useQueryProjects } from './hooks';

export const DefiScreen = () => {
  const { currentAccount } = useCurrentAccount();
  const {
    isTokensLoading,
    isPortfoliosLoading,
    portfolios,
    tokens,
    hasTokens,
    hasPortfolios,
    refreshPositions,
    grossNetWorth,
    tokenNetWorth,
  } = useQueryProjects(currentAccount!.address);

  return (
    <ProtocolList
      portfolios={portfolios}
      hasPortfolios={hasPortfolios}
      tokenNetWorth={0}
    />
  );
};
