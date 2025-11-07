import { useSendTokenInternalContext } from '../hooks/useSendToken';
import { View } from 'react-native';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';

export const ShowMoreOnSend = ({ chainServeId }: { chainServeId: string }) => {
  const {
    computed: { canSubmit, canDirectSign },
  } = useSendTokenInternalContext();

  if (!canSubmit || !canDirectSign) return null;

  return (
    <View style={[{ marginHorizontal: 0, marginTop: 12 }]}>
      <DirectSignGasInfo
        supportDirectSign={canDirectSign}
        loading={false}
        openShowMore={() => void 0}
        chainServeId={chainServeId}
      />
    </View>
  );
};
