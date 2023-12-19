import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { View } from 'react-native';
import { TokenWallet } from './components/TokenWallet';
import { useQueryProjects } from './hooks';

// render it need currentAccount is not null
export const TokenScreen = () => {
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
    <View>
      <TokenWallet tokens={tokens} tokenNetWorth={tokenNetWorth} />
    </View>
  );
};
