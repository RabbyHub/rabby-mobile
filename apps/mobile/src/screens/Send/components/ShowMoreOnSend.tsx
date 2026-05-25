import React from 'react';
import { useSendTokenInternalShallowSelector } from '../hooks/useSendToken';
import { View } from 'react-native';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';

export const ShowMoreOnSend = React.memo(function ShowMoreOnSend({
  chainServeId,
}: {
  chainServeId: string;
}) {
  const { canSubmit, canDirectSign, setReloadTxRefreshPaused } =
    useSendTokenInternalShallowSelector(ctx => ({
      canSubmit: ctx.computed.canSubmit,
      canDirectSign: ctx.computed.canDirectSign,
      setReloadTxRefreshPaused: ctx.callbacks.setReloadTxRefreshPaused,
    }));

  if (!canSubmit || !canDirectSign) return null;

  return (
    <View style={[{ marginHorizontal: 0, marginTop: 12 }]}>
      <DirectSignGasInfo
        supportDirectSign={canDirectSign}
        loading={false}
        openShowMore={() => void 0}
        chainServeId={chainServeId}
        onDepositPopupVisibleChange={setReloadTxRefreshPaused}
      />
    </View>
  );
});
