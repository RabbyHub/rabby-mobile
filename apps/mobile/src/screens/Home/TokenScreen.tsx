import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { TokenWallet } from './components/TokenWallet';
import { useQueryProjects } from './hooks';
import useSortToken from './hooks/useSortTokens';

// render it need currentAccount is not null
export const TokenScreen = () => {
  const { currentAccount } = useCurrentAccount();
  const { tokens, isTokensLoading, hasTokens } = useQueryProjects(
    currentAccount?.address,
    false,
    true,
  );
  const sortTokens = useSortToken(tokens);

  return (
    <TokenWallet
      tokens={sortTokens}
      isTokensLoading={isTokensLoading}
      hasTokens={hasTokens && sortTokens.length > 0}
    />
  );
};
