import React, { useMemo } from 'react';

import { getTokenIcon } from '@/utils/tokenIcon';
import { AssetAvatar } from '@/components/AssetAvatar';
import { CHAINS_ENUM } from '@debank/common';
import { useFindChain } from '@/hooks/useFindChain';

const TokenIcon = ({
  tokenSymbol,
  chain,
  size = 46,
  chainSize,
}: {
  tokenSymbol: string;
  chain?: string;
  size?: number;
  chainSize?: number;
}) => {
  const tokenLogoUrl = useMemo(() => getTokenIcon(tokenSymbol), [tokenSymbol]);
  const chainInfo = useFindChain({
    enum: chain || CHAINS_ENUM.ETH,
  });

  return (
    <AssetAvatar
      logo={tokenLogoUrl}
      size={size}
      chain={chainInfo?.serverId}
      chainIconPosition="br"
      chainSize={chainSize}
    />
  );
};

export default TokenIcon;
