import React, { useMemo } from 'react';

import { getTokenIcon } from '@/utils/tokenIcon';
import { AssetAvatar } from '@/components/AssetAvatar';
import { CHAINS_ENUM } from '@debank/common';
import { useFindChain } from '@/hooks/useFindChain';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

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
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <AssetAvatar
      logo={tokenLogoUrl}
      size={size}
      chain={chainInfo?.serverId}
      chainIconPosition="br"
      chainSize={chainSize}
      innerChainStyle={styles.innerChainStyle}
    />
  );
};
const getStyles = createGetStyles2024(({ colors2024 }) => ({
  innerChainStyle: {
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
}));

export default TokenIcon;
