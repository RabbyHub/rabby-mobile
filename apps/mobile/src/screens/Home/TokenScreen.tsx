import { useCurrentAccount } from '@/hooks/account';
import React from 'react';
import { TokenWallet } from './components/TokenWallet';
import { useQueryProjects } from './hooks';

// render it need currentAccount is not null
export const TokenScreen = () => {
  const { currentAccount } = useCurrentAccount();
  const { tokens, tokenNetWorth } = useQueryProjects(currentAccount!.address);

  return <TokenWallet tokens={tokens} tokenNetWorth={tokenNetWorth} />;
};
