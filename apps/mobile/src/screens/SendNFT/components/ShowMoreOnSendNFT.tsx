import React from 'react';
import { Dimensions, View } from 'react-native';

import { useSendNFTInternalShallowSelector } from '../hooks/useSendNFT';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';

export const ShowMoreOnSendNFT = React.memo(function ShowMoreOnSendNFT({
  chainServeId,
}: {
  chainServeId: string;
}) {
  const { canSubmit, canDirectSign } = useSendNFTInternalShallowSelector(
    ctx => ({
      canSubmit: ctx.computed.canSubmit,
      canDirectSign: ctx.computed.canDirectSign,
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
        style={[
          {
            flexDirection: 'row',
            justifyContent: 'space-between',
            // ...makeDebugBorder(),
          },
        ]}
        gasFeeListItemStyle={[
          {
            maxWidth: Dimensions.get('window').width - 24 * 2,
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            // ...makeDebugBorder('red'),
          },
        ]}
      />
    </View>
  );
});
