import { useEffect, useState } from 'react';
import { SendShowMore } from '@/screens/Bridge/components/BridgeShowMore';
import { useSendTokenInternalContext } from '../hooks/useSendToken';
import { View } from 'react-native';

export const ShowMoreOnSend = ({ chainServeId }: { chainServeId: string }) => {
  const [open, setOpen] = useState(false);

  const {
    computed: { canSubmit, canDirectSign },
  } = useSendTokenInternalContext();

  useEffect(() => {
    if (!canSubmit) {
      setOpen(false);
    }
  }, [canSubmit]);

  return canSubmit ? (
    <View style={{ marginHorizontal: -20 }}>
      <SendShowMore
        open={open}
        setOpen={setOpen}
        supportDirectSign={canDirectSign}
        loading={false}
        chainServeId={chainServeId}
      />
    </View>
  ) : null;
};
