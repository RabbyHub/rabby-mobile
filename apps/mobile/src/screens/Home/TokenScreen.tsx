import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { TokenWallet } from './components/TokenWallet';
import { useQueryProjects } from './hooks';

// render it need currentAccount is not null
export const TokenScreen = () => {
  const { currentAccount } = useCurrentAccount();
  const { tokens, tokenNetWorth, isTokensLoading, hasTokens } =
    useQueryProjects(currentAccount!.address);

  return (
    <TokenWallet
      tokens={tokens}
      isTokensLoading={isTokensLoading}
      hasTokens={hasTokens}
      tokenNetWorth={tokenNetWorth}
    />
  );
};
