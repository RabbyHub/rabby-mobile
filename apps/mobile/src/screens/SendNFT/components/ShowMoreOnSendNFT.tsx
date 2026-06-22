import React from 'react';
import { View } from 'react-native';

import {
  useSendNFTCanSubmit,
  useSendNFTInternalShallowSelector,
} from '../hooks/useSendNFT';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';

export const ShowMoreOnSendNFT = React.memo(function ShowMoreOnSendNFT() {
  const canSubmit = useSendNFTCanSubmit();
  const { canDirectSign, chainServeId } = useSendNFTInternalShallowSelector(
    ctx => ({
      canDirectSign: ctx.computed.canDirectSign,
      chainServeId: ctx.computed.chainItem?.serverId || '',
    }),
  );

  if (!canSubmit || !canDirectSign) return null;

  return (
    <View style={[{ marginTop: 12 }]}>
      <DirectSignGasInfo
        supportDirectSign={canDirectSign}
        loading={false}
        openShowMore={() => void 0}
        chainServeId={chainServeId}
      />
    </View>
  );
});
